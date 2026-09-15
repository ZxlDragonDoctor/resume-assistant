"""
规则引擎 —— 无 LLM 时的本地兜底实现。

设计目标：即使没有配置 API Key，AI 相关接口也要返回**有实际价值**的结果，
而不是报错或返回空白。这里用启发式规则 + 预置语料完成：

  * 要点润色：动词前置、量化引导、去除口语化表达
  * 个人总结：依据岗位与技能拼装结构化模板
  * ATS 评分：基于技能词典 / 关键词覆盖率 / 结构完整性打分
  * JD 解析：正则抽取技能词、学历、年限要求
"""
from __future__ import annotations

import re
from typing import Iterable

# ------------------------------------------------------------------
# 技能词典（按领域分组，用于关键词匹配与技能抽取）
# ------------------------------------------------------------------

SKILL_DICT: dict[str, list[str]] = {
    "后端": [
        "Java", "Spring", "Spring Boot", "Spring Cloud", "MyBatis", "MyBatis-Plus",
        "Hibernate", "JPA", "Netty", "Dubbo", "Nacos", "Sentinel", "RocketMQ",
        "Kafka", "RabbitMQ", "Redis", "MySQL", "PostgreSQL", "MongoDB", "Elasticsearch",
        "ClickHouse", "Oracle", "Maven", "Gradle", "JVM", "JUC", "多线程", "分布式",
        "微服务", "高并发", "限流", "熔断", "分库分表", "DDD", "gRPC", "Linux",
        "Go", "Golang", "Gin", "Python", "Django", "Flask", "FastAPI", "Celery",
        "Node.js", "Express", "NestJS", "PHP", "Laravel", "C++", "C#", ".NET", "Rust",
    ],
    "前端": [
        "JavaScript", "TypeScript", "React", "Vue", "Vue3", "Angular", "Next.js",
        "Nuxt", "Webpack", "Vite", "Rollup", "Babel", "ESLint", "HTML5", "CSS3",
        "Sass", "Less", "Tailwind", "Ant Design", "Element UI", "Redux", "Zustand",
        "Pinia", "Vuex", "React Native", "Flutter", "小程序", "UniApp", "Electron",
        "Three.js", "ECharts", "WebGL", "SSR", "PWA", "性能优化",
    ],
    "数据": [
        "SQL", "Hive", "Spark", "Flink", "Hadoop", "MapReduce", "Airflow",
        "DataX", "Kettle", "Pandas", "NumPy", "ETL", "数据仓库", "数据建模",
        "OLAP", "Doris", "StarRocks", "Kylin", "Superset", "Tableau", "Power BI",
    ],
    "算法": [
        "机器学习", "深度学习", "PyTorch", "TensorFlow", "Keras", "Scikit-learn",
        "NLP", "CV", "推荐系统", "知识图谱", "Transformer", "BERT", "LLM",
        "RAG", "LangChain", "向量数据库", "Milvus", "Faiss", "Prompt",
        "XGBoost", "LightGBM", "特征工程", "A/B测试",
    ],
    "测试": [
        "JUnit", "Mockito", "TestNG", "Selenium", "Cypress", "Playwright",
        "JMeter", "Postman", "接口测试", "自动化测试", "性能测试", "单元测试",
        "TDD", "CI/CD", "Jenkins", "GitLab CI", "Docker", "Kubernetes", "K8s",
        "DevOps", "Prometheus", "Grafana", "ELK", "SkyWalking",
    ],
    "通用": [
        "Git", "SVN", "Docker", "Kubernetes", "Nginx", "Tomcat", "阿里云",
        "AWS", "Azure", "设计模式", "重构", "敏捷开发", "Scrum", "项目管理",
        "团队协作", "技术方案", "需求分析", "架构设计", "代码评审",
    ],
}

ALL_SKILLS: list[str] = sorted(
    {s for group in SKILL_DICT.values() for s in group}, key=len, reverse=True
)

# 弱动词 → 强动词，用户写"负责了""参与了"这类模糊表述时替换
WEAK_TO_STRONG_VERBS = {
    "负责了": "主导",
    "负责": "主导",
    "参与了": "参与并推动",
    "参与": "深度参与",
    "帮助": "支撑",
    "做了": "完成",
    "搞了": "落地",
    "弄了": "实现",
    "写了": "开发",
    "弄": "实现",
    "帮忙": "协同",
}

# 缺少量化时追加的引导语，提醒用户在真实场景下补数字
QUANTIFY_HINTS = [
    "（建议补充量化指标，如提升 30%、覆盖 10w+ 用户）",
]


# ------------------------------------------------------------------
# 工具函数
# ------------------------------------------------------------------

def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def extract_skills(text: str) -> list[str]:
    """从任意文本中抽取命中的技能关键词（保持词典顺序，去重）。"""
    if not text:
        return []
    found: list[str] = []
    lower = text.lower()
    for skill in ALL_SKILLS:
        if skill.lower() in lower and skill not in found:
            found.append(skill)
    return found


def extract_years(text: str) -> str | None:
    """抽取经验年限要求，如 '3年以上'、'3-5年'。"""
    if not text:
        return None
    m = re.search(r"(\d+)\s*[-~至]\s*(\d+)\s*年", text)
    if m:
        return f"{m.group(1)}-{m.group(2)}年"
    m = re.search(r"(\d+)\s*年(?:以上|及以上)?", text)
    if m:
        return f"{m.group(1)}年以上"
    return None


def extract_education(text: str) -> str | None:
    """抽取学历要求。"""
    if not text:
        return None
    for level in ["博士", "硕士", "研究生", "本科", "大专", "专科"]:
        if level in text:
            return level
    return None


def _has_quantification(text: str) -> bool:
    """判断一条要点是否包含量化信息（数字 / 百分比 / 规模词）。"""
    return bool(
        re.search(r"\d+(\.\d+)?\s*(%|％|倍|万|亿|k|K|w|W|人|次|个|天|小时|ms|s\b)", text)
        or re.search(r"提升|降低|增长|减少|优化了?\s*\d", text)
    )


# ------------------------------------------------------------------
# 要点润色
# ------------------------------------------------------------------

def optimize_bullet_local(job_title: str, content: str) -> str:
    """
    规则版要点润色：
      1. 清理口语化/模糊表述
      2. 动词前置强化
      3. 缺失量化时追加提示
      4. 多行输入时逐行处理
    """
    text = _normalize(content)
    if not text:
        return "请先填写要优化的经历描述。"

    lines = [l.strip() for l in re.split(r"[\n；;]+", content) if l.strip()]
    results: list[str] = []

    for line in lines:
        item = line.lstrip("-•*0123456789.、) ").strip()
        if not item:
            continue

        # 弱动词替换
        for weak, strong in WEAK_TO_STRONG_VERBS.items():
            if item.startswith(weak):
                item = strong + item[len(weak):]
                break

        # 如果完全不以动词开头，补一个引导动词
        if not re.match(r"^(主导|负责|参与|推动|设计|开发|实现|搭建|优化|重构|"
                        r"落地|完成|支撑|协同|建设|引入|制定|管理|维护|分析|"
                        r"提升|降低|解决|排查|编写|交付|上线)", item):
            item = "负责" + item if len(item) < 12 else "主导" + item[0].lower() + item[1:]

        # 量化提示
        if not _has_quantification(item):
            item = item.rstrip("。.") + "，建议补充量化结果（如效率提升 30%）"

        results.append("• " + item.rstrip("。."))

    if not results:
        return "请先填写要优化的经历描述。"

    header = f"【{job_title}】优化建议：\n" if job_title else "优化建议：\n"
    footer = (
        "\n\n提示：当前为本地规则引擎结果。配置 AI_API_KEY 后可获得基于大模型的"
        "深度改写（STAR 法则 + 行业术语 + 成果量化）。"
    )
    return header + "\n".join(results) + footer


# ------------------------------------------------------------------
# 个人总结
# ------------------------------------------------------------------

def generate_summary_local(resume_info: str) -> str:
    """基于简历信息拼装一段结构化个人总结。"""
    text = _normalize(resume_info)
    if not text:
        return "请先填写教育背景、技能与项目经历，再生成个人总结。"

    skills = extract_skills(resume_info)[:6]
    years = extract_years(resume_info)
    education = extract_education(resume_info)

    # 尝试识别岗位方向
    job_hint = ""
    for kw in ["后端", "前端", "全栈", "算法", "数据", "测试", "运维", "产品", "运营"]:
        if kw in resume_info:
            job_hint = kw
            break

    parts: list[str] = []
    if education:
        parts.append(f"{education}学历")
    if job_hint:
        parts.append(f"{job_hint}方向工程师")
    elif skills:
        parts.append("软件工程师")

    lead = "".join(parts) if parts else "技术从业者"

    body = f"{lead}"
    if years:
        body += f"，具备 {years}相关经验"
    if skills:
        body += f"，熟练掌握 {'、'.join(skills)}"
    body += "。擅长在复杂业务场景下拆解问题、设计技术方案并落地，对代码质量与系统性能有较高要求。"

    tail = (
        "关注工程效率与业务价值，具备良好的沟通协作能力，能够快速融入团队并承担核心模块开发。"
    )
    return f"{body}{tail}"


# ------------------------------------------------------------------
# ATS 评分
# ------------------------------------------------------------------

def ats_score_local(job_description: str, resume_content: str) -> dict:
    """
    规则版 ATS 评分。四个维度加权得出综合分：
      keywords   40%  岗位关键词覆盖率
      skills     25%  技能命中率
      experience 20%  量化描述与结构完整度
      education  15%  学历/年限匹配
    """
    jd = job_description or ""
    resume = resume_content or ""

    jd_skills = extract_skills(jd)
    resume_skills = extract_skills(resume)

    # --- 关键词 ---
    if jd_skills:
        hit = [s for s in jd_skills if s in resume_skills]
        keywords_score = round(len(hit) / len(jd_skills) * 100)
    else:
        keywords_score = 60 if resume_skills else 40
    missing = [s for s in jd_skills if s not in resume_skills]

    # --- 技能 ---
    skills_score = min(100, round(len(resume_skills) / 12 * 100)) if resume_skills else 30

    # --- 经验（量化密度 + 篇幅） ---
    bullet_lines = [l for l in re.split(r"[\n；;]", resume) if l.strip()]
    quantified = sum(1 for l in bullet_lines if _has_quantification(l))
    quant_ratio = quantified / len(bullet_lines) if bullet_lines else 0
    length_score = min(100, len(resume) / 8)
    experience_score = round(quant_ratio * 60 + min(length_score, 100) * 0.4)

    # --- 教育 ---
    jd_edu = extract_education(jd)
    resume_edu = extract_education(resume)
    order = {"博士": 5, "硕士": 4, "研究生": 4, "本科": 3, "大专": 2, "专科": 2}
    if jd_edu and resume_edu:
        education_score = 100 if order.get(resume_edu, 0) >= order.get(jd_edu, 0) else 55
    elif resume_edu:
        education_score = 85
    else:
        education_score = 45

    overall = round(
        keywords_score * 0.40
        + skills_score * 0.25
        + experience_score * 0.20
        + education_score * 0.15
    )

    suggestions: list[str] = []
    if missing:
        suggestions.append(
            f"岗位要求但简历中未体现的技能：{'、'.join(missing[:8])}。"
            "如果实际掌握，建议在「专业技能」中显式列出。"
        )
    if quant_ratio < 0.5:
        suggestions.append(
            "经历描述缺少量化成果。建议用「动作 + 方法 + 结果」结构，"
            "补上性能提升、覆盖率、用户量等具体数字。"
        )
    if len(resume) < 300:
        suggestions.append("简历内容偏薄，建议补充 2-3 段完整的项目经历，说明背景、职责与产出。")
    if not extract_skills(resume):
        suggestions.append("未识别到技术关键词，建议使用招聘方熟悉的行业术语（如具体框架、中间件名称）。")
    if not jd_skills:
        suggestions.append("职位描述中未识别到技术关键词，建议粘贴更完整的 JD 以获得准确评分。")
    if education_score < 70 and jd_edu:
        suggestions.append(f"岗位要求 {jd_edu} 学历，请注意在简历中明确标注教育背景。")

    if not suggestions:
        suggestions.append("整体匹配度不错。可继续打磨措辞，让每条经历都指向岗位核心要求。")

    return {
        "scores": {
            "keywords": keywords_score,
            "skills": skills_score,
            "experience": experience_score,
            "education": education_score,
            "overall": overall,
        },
        "suggestions": suggestions,
        "matchedSkills": [s for s in jd_skills if s in resume_skills],
        "missingSkills": missing,
        "engine": "rule",
    }


# ------------------------------------------------------------------
# JD 解析
# ------------------------------------------------------------------

def parse_jd_local(job_description: str) -> dict:
    """从职位描述中抽取结构化信息。"""
    jd = job_description or ""
    return {
        "skills": extract_skills(jd),
        "years": extract_years(jd),
        "education": extract_education(jd),
        "responsibilities": _extract_bullets(jd, ["负责", "参与", "承担", "根据", "完成"]),
        "requirements": _extract_bullets(jd, ["熟悉", "掌握", "精通", "了解", "具备", "要求"]),
        "engine": "rule",
    }


def _extract_bullets(text: str, keywords: Iterable[str]) -> list[str]:
    out: list[str] = []
    for line in re.split(r"[\n。；;]", text):
        line = line.strip(" -•*0123456789.、")
        if not line or len(line) < 4:
            continue
        if any(k in line for k in keywords):
            out.append(line[:120])
    return out[:8]


def match_skills_local(resume_content: str, job_description: str) -> dict:
    """计算简历与 JD 的技能交集 / 差集，用于「匹配度」可视化。"""
    jd_skills = extract_skills(job_description)
    resume_skills = extract_skills(resume_content)
    matched = [s for s in jd_skills if s in resume_skills]
    missing = [s for s in jd_skills if s not in resume_skills]
    extra = [s for s in resume_skills if s not in jd_skills]
    rate = round(len(matched) / len(jd_skills) * 100) if jd_skills else 0
    return {
        "matched": matched,
        "missing": missing,
        "extra": extra,
        "matchRate": rate,
        "engine": "rule",
    }


def interview_questions_local(job_title: str, resume_content: str) -> list[str]:
    """根据岗位与简历内容生成面试问题清单。"""
    skills = extract_skills(resume_content)[:5]
    title = job_title or "该岗位"
    questions = [
        f"请用 2 分钟介绍一下你与{title}相关的核心经历。",
        "你在最近一个项目中承担了哪些具体职责？遇到的最大技术难点是什么，如何解决的？",
        "描述一次你与团队在方案上产生分歧的经历，最终如何达成一致？",
    ]
    for s in skills:
        questions.append(f"你在项目中是如何使用 {s} 的？遇到过哪些坑？")
    questions.append("你如何评估自己方案的性能表现？做过哪些优化、效果如何量化？")
    questions.append("未来一年你的技术成长规划是什么？")
    return questions[:10]
