"""Offline resume assistance using conservative, explainable rules.

Applicable content contains source facts only. Analysis and interview helpers use
the same canonical vocabulary across technical and nontechnical professions.
"""
from __future__ import annotations

import re
from typing import Iterable


SKILL_DICT: dict[str, list[str]] = {
    "后端": [
        "Java", "Spring", "Spring Boot", "Spring Cloud", "MyBatis", "MyBatis-Plus",
        "Hibernate", "JPA", "Netty", "Dubbo", "Nacos", "Sentinel", "RocketMQ",
        "Kafka", "RabbitMQ", "Redis", "MySQL", "PostgreSQL", "MongoDB", "Elasticsearch",
        "ClickHouse", "Oracle", "Maven", "Gradle", "JVM", "JUC", "多线程", "分布式",
        "微服务", "高并发", "限流", "熔断", "分库分表", "DDD", "gRPC", "Linux",
        "Go", "Gin", "Python", "Django", "Flask", "FastAPI", "Celery", "REST",
        "Node.js", "Express", "NestJS", "PHP", "Laravel", "C++", "C#", ".NET", "Rust",
    ],
    "前端": [
        "JavaScript", "TypeScript", "React", "Vue", "Angular", "Next.js", "Nuxt",
        "Webpack", "Vite", "Rollup", "Babel", "ESLint", "HTML", "CSS", "Sass", "Less",
        "Tailwind", "Ant Design", "Element UI", "Redux", "Zustand", "Pinia", "Vuex",
        "React Native", "Flutter", "小程序", "UniApp", "Electron", "Three.js", "ECharts",
        "WebGL", "SSR", "PWA", "性能优化", "可访问性", "响应式设计",
    ],
    "数据": [
        "SQL", "Hive", "Spark", "Flink", "Hadoop", "MapReduce", "Airflow", "DataX",
        "Kettle", "Pandas", "NumPy", "ETL", "数据仓库", "数据建模", "OLAP", "Doris",
        "StarRocks", "Kylin", "Superset", "Tableau", "Power BI", "数据清洗", "统计分析",
        "指标字典", "漏斗分析", "分群", "窗口函数", "置信区间", "异常核对",
    ],
    "算法": [
        "机器学习", "深度学习", "PyTorch", "TensorFlow", "Keras", "Scikit-learn", "NLP",
        "CV", "推荐系统", "知识图谱", "Transformer", "BERT", "LLM", "RAG", "LangChain",
        "向量数据库", "Milvus", "Faiss", "Prompt", "XGBoost", "LightGBM", "特征工程",
        "A/B测试", "样本清洗", "分层评估", "错误分析", "推理延迟",
    ],
    "测试": [
        "JUnit", "Mockito", "TestNG", "Selenium", "Cypress", "Playwright", "pytest",
        "JMeter", "Postman", "接口测试", "自动化测试", "性能测试", "单元测试", "TDD",
        "CI/CD", "Jenkins", "GitLab CI", "Docker", "Kubernetes", "DevOps", "Prometheus",
        "Grafana", "ELK", "SkyWalking", "等价类", "边界值", "状态迁移", "缺陷复现",
    ],
    "产品": [
        "用户研究", "用户访谈", "需求分析", "需求优先级", "原型设计", "交互原型",
        "验收用例", "埋点", "竞品分析", "产品设计", "状态建模", "上线复盘",
        "任务流程", "需求文档", "用户旅程", "业务分析", "单位经济模型",
    ],
    "设计": [
        "Figma", "Sketch", "Photoshop", "Illustrator", "InDesign", "交互设计", "信息架构",
        "视觉设计", "品牌设计", "排版", "可用性测试", "印前检查", "工艺打样",
        "源文件规范", "设计规范", "组件设计", "包装设计", "空状态",
    ],
    "商业与办公": [
        "Excel", "Word", "PowerPoint", "Office", "CRM", "ERP", "会议纪要", "任务拆解",
        "风险记录", "风险台账", "里程碑", "资源协调", "变更影响", "验收证据", "客户回访",
        "招聘", "简历筛选", "面试安排", "候选人沟通", "考勤", "入职", "人事档案",
        "应收", "应付", "凭证", "月结", "预算", "内控", "财务核对", "数据透视表",
        "采购", "供应商", "库存", "交期", "询比价", "合同核对", "总成本",
        "商机", "销售预测", "采购流程", "报价", "异议跟进", "回款", "续约",
        "问卷", "访谈纪要", "经营汇报", "商业分析", "毛利", "收入", "渠道分析",
    ],
    "运营": [
        "用户运营", "内容运营", "生命周期", "留存", "社群", "活动执行", "活动排期",
        "内容策划", "选题", "事实核对", "脚本", "图文排版", "素材授权", "剪映", "转化率",
    ],
    "学术与教育": [
        "R", "tidyverse", "SPSS", "Stata", "文献检索", "实验设计", "混合效应模型",
        "研究记录", "学术图表", "学术写作", "研究伦理", "统计建模", "可复现报告",
        "教学设计", "教学评价", "教学反思", "分层作业", "作业分析", "形成性评价",
        "单元任务", "家校沟通", "公开课", "课堂观察", "学情分析",
    ],
    "医护": [
        "护理评估", "护理记录", "生命体征", "异常报告", "身份核对", "用药查对", "手卫生",
        "交接班", "患者沟通", "患者宣教", "健康评估", "基础护理", "护理伦理", "护理研究",
        "药学服务", "医嘱核对", "医嘱信息核对", "用药史采集", "用药指导", "用药教育",
        "干预记录", "问题分级", "随访", "证据管理", "药物相互作用", "处方审核",
    ],
    "通用": [
        "Git", "SVN", "Docker", "Kubernetes", "Nginx", "Tomcat", "阿里云", "AWS", "Azure",
        "设计模式", "重构", "敏捷开发", "Scrum", "项目管理", "团队协作", "技术方案",
        "架构设计", "代码评审", "文档管理", "跨团队评审", "过程记录",
    ],
}

# Aliases are canonicalized before matching, so one mention is one skill.
SKILL_ALIASES: dict[str, tuple[str, ...]] = {
    "JavaScript": ("JS",), "TypeScript": ("TS",), "Go": ("Golang",),
    "PostgreSQL": ("Postgres", "PgSQL"), "Vue": ("Vue.js", "Vue3", "Vue 3"),
    "React": ("React.js",), "HTML": ("HTML5",), "CSS": ("CSS3",),
    "Node.js": ("NodeJS", "Node JS"), "Next.js": ("NextJS",),
    "Kubernetes": ("K8s",), "Scikit-learn": ("sklearn",), "PowerPoint": ("PPT",),
    "Spring Boot": ("SpringBoot",), "Spring Cloud": ("SpringCloud",),
    "A/B测试": ("A/B test", "A/B testing", "AB测试"),
    "数据透视表": ("透视表",),
}

ALL_SKILLS: list[str] = sorted(
    {skill for group in SKILL_DICT.values() for skill in group},
    key=lambda skill: (-len(skill), skill.casefold()),
)


def _skill_pattern(term: str) -> re.Pattern:
    # Unicode \b treats adjacent Chinese letters as the same word.
    # ASCII boundaries allow "使用Java开发" while excluding JavaScript and Django.
    escaped = re.escape(term).replace(r"\ ", r"\s+")
    return re.compile(r"(?<![A-Za-z0-9_])" + escaped + r"(?![A-Za-z0-9_])", re.I)


_SKILL_PATTERNS = [
    (skill, _skill_pattern(alias))
    for skill in ALL_SKILLS
    for alias in dict.fromkeys((skill, *SKILL_ALIASES.get(skill, ())))
]


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def extract_skills(text: str) -> list[str]:
    """Extract canonical skills with boundaries and longest-mention precedence."""
    if not text:
        return []
    candidates = [
        (match.start(), match.end(), skill)
        for skill, pattern in _SKILL_PATTERNS
        for match in pattern.finditer(text)
    ]
    occupied: list[tuple[int, int]] = []
    found: set[str] = set()
    for start, end, skill in sorted(candidates, key=lambda item: (-(item[1] - item[0]), item[0])):
        if any(start < occupied_end and end > occupied_start for occupied_start, occupied_end in occupied):
            continue
        occupied.append((start, end))
        found.add(skill)
    return [skill for skill in ALL_SKILLS if skill in found]


_YEAR_NUMBER = r"(?:\d+(?:\.\d+)?|[零〇一二两三四五六七八九十]{1,3})"
_YEAR_RANGE = re.compile(
    rf"(?<![\d.])({_YEAR_NUMBER})\s*[-–—~～至到]\s*({_YEAR_NUMBER})\s*年"
)
_YEAR_SINGLE = re.compile(rf"(?<![\d.零〇一二两三四五六七八九十])({_YEAR_NUMBER})\s*年")
_EDUCATION_ORDER = {"博士": 5, "硕士": 4, "研究生": 4, "本科": 3, "大专": 2, "专科": 2, "中专": 1, "高中": 1}


def _year_number(value: str) -> float:
    if re.fullmatch(r"\d+(?:\.\d+)?", value):
        return float(value)
    digits = {"零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4,
              "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
    if "十" in value:
        tens, units = value.split("十", 1)
        if (not tens or tens in digits) and (not units or units in digits):
            return (digits[tens] if tens else 1) * 10 + (digits[units] if units else 0)
    return float(digits.get(value, -1))


def _format_years(value: float) -> str:
    return f"{value:g}"


def _is_experience_context(text: str, start: int, end: int) -> bool:
    before, after = text[max(0, start - 12):start], text[end:end + 15]
    if re.match(r"\s*(?:制|级|届|毕业|入学|出生|本科|硕士|博士|大专|专科|课程|学制)", after):
        return False
    if re.search(r"(?:学制|在校|就读|出生|未来|计划|合同期|保质期|有效期|项目周期|项目持续|项目期限|项目耗时)\s*$", before):
        return False
    if re.search(r"(?:研究生|本科|硕士|博士|大专|专科|大学|高中)\s*$", before) and not re.search(r"工作|经验|执业", after):
        return False
    return True


def extract_years(text: str) -> str | None:
    """Keep experience bounds; calendar years and education durations are excluded."""
    if not text:
        return None
    ranges = list(_YEAR_RANGE.finditer(text))
    for match in ranges:
        lower, upper = _year_number(match[1]), _year_number(match[2])
        if 0 <= lower <= upper <= 60 and _is_experience_context(text, *match.span()):
            return f"{_format_years(lower)}-{_format_years(upper)}年"
    for match in _YEAR_SINGLE.finditer(text):
        if any(match.start() < item.end() and match.end() > item.start() for item in ranges):
            continue
        value = _year_number(match[1])
        if not 0 <= value <= 60 or not _is_experience_context(text, *match.span()):
            continue
        before = text[max(0, match.start() - 6):match.start()]
        after = text[match.end():match.end() + 5]
        years = f"{_format_years(value)}年"
        if re.match(r"\s*(?:以内|以下|及以下|内)", after) or re.search(r"(?:最多|不超过|至多|不足|不满|少于|小于)\s*$", before):
            return years + "以内"
        if re.match(r"\s*(?:以上|及以上|起)", after) or re.search(r"(?:至少|不少于|最低)\s*$", before):
            return years + "以上"
        return years
    if re.search(r"(?:工作)?经验不限|不限(?:工作)?经验|无需(?:工作)?经验|无经验要求", text):
        return "经验不限"
    if "应届" in text:
        return "应届"
    return None


def extract_education(text: str) -> str | None:
    """Return the minimum required degree, excluding preferences."""
    if not text or re.search(r"学历\s*不限|不限\s*学历", text):
        return None
    required: list[str] = []
    for clause in re.split(r"[，,。；;\n]", text):
        degrees = list(re.finditer("|".join(_EDUCATION_ORDER), clause))
        for index, degree in enumerate(degrees):
            next_start = degrees[index + 1].start() if index + 1 < len(degrees) else len(clause)
            qualifier = clause[degree.end():next_start]
            if not re.search(r"优先|优选|加分|preferred|preferably", qualifier, re.I):
                required.append(degree[0])
    return min(required, key=_EDUCATION_ORDER.get) if required else None


def _has_quantification(text: str) -> bool:
    """A measured number is required; verbs and dates alone are not results."""
    return bool(re.search(
        r"(?<![\d.])\d+(?:\.\d+)?\s*(?:%|％|倍|万|亿|[kKwW]\+?|人|名|次|个|份|家|件|笔|条|项|台|页|天|小时|分钟|秒|毫秒|ms\b|s\b)",
        text or "",
    ))


def _strip_list_marker(line: str) -> str:
    # Consume an actual marker, never a set of leading digits (e.g. 2024 年).
    return re.sub(r"^\s*(?:[•*]\s*|-\s*(?=[^\d\s])|\d{1,2}\.(?!\d)\s*|\d{1,2}[、)]\s*)", "", line).strip()


def optimize_bullet_local(job_title: str, content: str) -> str:
    """Clean formatting and aspect words without upgrading responsibilities.

    Notices and suggestions belong to response metadata, never applicable text.
    A local rule cannot infer achievements, authority, skills, or percentages.
    """
    results: list[str] = []
    for line in (content or "").splitlines():
        item = _normalize(_strip_list_marker(line))
        for original, cleaned in (("负责了", "负责"), ("参与了", "参与"), ("帮忙", "协助")):
            if item.startswith(original):
                item = cleaned + item[len(original):]
                break
        if item:
            results.append(item)
    return "\n".join(results)


def generate_summary_local(resume_info: str) -> str:
    """Extract short factual source statements without inventing a persona.

    Local fallback deliberately preserves the stated level of proficiency and
    responsibility. Dates are left as dates and are never converted into tenure.
    """
    lines = (resume_info or "").splitlines()
    content_marker = next((index for index, line in enumerate(lines)
                           if re.match(r"^\s*现有简历内容\s*[:：]?\s*$", line)), None)
    if content_marker is not None:
        # The editor prepends analysis context; it is not candidate-authored content.
        lines = lines[content_marker + 1:]

    fragments: list[str] = []
    headings = {"基本信息", "个人总结", "工作经历", "项目经历", "实习经历", "教育背景", "专业技能", "技能", "证书", "自我评价"}
    section = ""
    for source_line in lines:
        raw = source_line.strip()
        if re.match(r"^(?:目标岗位|相关经验年限)\s*[:：]", raw):
            continue
        if raw.startswith("##"):
            section = raw.lstrip("# ").rstrip("：:").strip()
            continue
        if not raw or section == "基本信息" or raw.rstrip("：:") in headings:
            continue
        # Company/school/date headings add context, but are not achievements.
        if re.search(r"\(\s*\d{4}[-/年].*(?:至今|\d{4})\s*\)", raw):
            continue

        line = _strip_list_marker(raw)
        line = re.sub(r"^(?:个人总结|职业概述|自我评价)\s*[:：]\s*", "", line)
        line = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "", line)
        line = re.sub(r"(?<!\d)1[3-9][\d*]{9}(?!\d)", "", line)
        if re.match(r"^(?:姓名|电话|手机|邮箱|地址|联系方式)\s*[:：]", line):
            continue
        for fragment in re.split(r"[。；;\n]+", line):
            fragment = _normalize(fragment).strip(" |，,。")
            if fragment and fragment not in fragments:
                fragments.append(fragment)
    if not fragments:
        return ""
    selected: list[str] = []
    for fragment in fragments:
        if selected and len("。".join(selected)) + len(fragment) > 350:
            break
        selected.append(fragment)
        if len(selected) >= 3:
            break
    return "。".join(selected) + ("。" if selected else "")


def _experience_bounds(value: str | None) -> tuple[float, float] | None:
    if not value or value == "经验不限":
        return None
    if value == "应届":
        return 0, 0
    numbers = [float(item) for item in re.findall(r"\d+(?:\.\d+)?", value)]
    if len(numbers) == 2:
        return numbers[0], numbers[1]
    if not numbers:
        return None
    number = numbers[0]
    if "以内" in value:
        return 0, number
    if "以上" in value:
        return number, 60
    return number, number


def _experience_match(jd: str, resume: str) -> tuple[int, str | None]:
    requirement, actual = extract_years(jd), extract_years(resume)
    required_bounds, actual_bounds = _experience_bounds(requirement), _experience_bounds(actual)
    if required_bounds is None:
        return 70, None
    if actual_bounds is None:
        return 45, f"岗位经验年限要求为{requirement}，简历未明确工作经验年限；请补充真实工作时间或年限。"
    required_minimum, required_maximum = required_bounds
    actual_minimum, actual_maximum = actual_bounds
    if actual_maximum < required_minimum:
        return 20, f"岗位经验年限要求为{requirement}，简历标注为{actual}；请结合真实经历评估匹配程度。"
    if actual_minimum > required_maximum and "以内" in (requirement or ""):
        return 60, f"岗位经验年限要求为{requirement}，简历标注为{actual}；请确认招聘范围。"
    if actual_minimum < required_minimum:
        return 60, f"岗位经验年限要求为{requirement}，简历中的{actual}尚不能确认满足最低年限。"
    return 100, None


def ats_score_local(job_description: str, resume_content: str) -> dict:
    """Compare JD coverage, stated experience, measured evidence, and degree."""
    jd, resume = job_description or "", resume_content or ""
    jd_skills, resume_skills = extract_skills(jd), extract_skills(resume)
    matched = [skill for skill in jd_skills if skill in resume_skills]
    missing = [skill for skill in jd_skills if skill not in resume_skills]
    coverage = round(len(matched) / len(jd_skills) * 100) if jd_skills else 50
    bullet_lines = [line for line in re.split(r"[\n；;]", resume) if line.strip()]
    quantified = sum(_has_quantification(line) for line in bullet_lines)
    quant_ratio = quantified / len(bullet_lines) if bullet_lines else 0
    tenure_score, tenure_suggestion = _experience_match(jd, resume)
    experience_score = round(tenure_score * 0.8 + quant_ratio * 20) if resume.strip() else 0

    jd_education = extract_education(jd)
    actual_degrees = [level for level in _EDUCATION_ORDER if level in resume]
    resume_education = max(actual_degrees, key=_EDUCATION_ORDER.get) if actual_degrees else None
    if jd_education and resume_education:
        education_score = 100 if _EDUCATION_ORDER[resume_education] >= _EDUCATION_ORDER[jd_education] else 40
    elif jd_education:
        education_score = 45
    else:
        education_score = 70

    overall = round(coverage * .40 + coverage * .25 + experience_score * .20 + education_score * .15)
    suggestions: list[str] = []
    if missing:
        suggestions.append(f"岗位要求但简历未体现的技能或方法：{'、'.join(missing[:8])}。仅在实际掌握或使用过时补充。")
    if tenure_suggestion:
        suggestions.append(tenure_suggestion)
    if quant_ratio < .5:
        suggestions.append("经历可补充真实的范围、数量或结果，说明个人职责和产出；没有可靠数据时保留事实描述。")
    if len(resume.strip()) < 300:
        suggestions.append("简历信息较少，可补充与岗位相关的工作、实习、项目或实践，写清背景、职责和产出。")
    if not jd_skills:
        suggestions.append("职位描述中未识别到明确的专业技能或方法，相关分数暂作中性参考；可补充完整岗位要求。")
    if education_score < 70 and jd_education:
        suggestions.append(f"岗位最低学历要求为{jd_education}，请明确标注实际教育背景并核对要求。")
    if not suggestions:
        suggestions.append("已覆盖识别到的岗位要求，可继续核对职责、经历与实际成果。")
    return {
        "scores": {"keywords": coverage, "skills": coverage, "experience": experience_score,
                   "education": education_score, "overall": overall},
        "suggestions": suggestions,
        "matchedSkills": matched,
        "missingSkills": missing,
        "engine": "rule",
    }


def parse_jd_local(job_description: str) -> dict:
    jd = job_description or ""
    return {
        "skills": extract_skills(jd),
        "years": extract_years(jd),
        "education": extract_education(jd),
        "responsibilities": _extract_bullets(jd, ["负责", "参与", "承担", "根据", "完成", "执行", "协助"]),
        "requirements": _extract_bullets(jd, ["熟悉", "掌握", "精通", "了解", "具备", "要求", "学历", "经验"]),
        "engine": "rule",
    }


def _extract_bullets(text: str, keywords: Iterable[str]) -> list[str]:
    out: list[str] = []
    for line in re.split(r"[\n。；;]", text):
        line = _strip_list_marker(line)
        if len(line) >= 4 and any(keyword in line for keyword in keywords):
            out.append(line[:120])
    return out[:8]


def match_skills_local(resume_content: str, job_description: str) -> dict:
    jd_skills, resume_skills = extract_skills(job_description), extract_skills(resume_content)
    matched = [skill for skill in jd_skills if skill in resume_skills]
    return {
        "matched": matched,
        "missing": [skill for skill in jd_skills if skill not in resume_skills],
        "extra": [skill for skill in resume_skills if skill not in jd_skills],
        "matchRate": round(len(matched) / len(jd_skills) * 100) if jd_skills else 0,
        "engine": "rule",
    }


_ROLE_CUES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("护理", ("护士", "护理")), ("药学", ("药师", "药学")),
    ("教学", ("教师", "教学")), ("学术", ("科研", "研究助理", "学术", "研究员")),
    ("产品", ("产品经理", "产品助理", "产品设计", "产品")),
    ("设计", ("设计师", "UI/UX", "UX", "视觉", "品牌")),
    ("商业", ("商业分析", "业务分析", "财务", "会计", "人力", "招聘", "销售", "客户经理", "供应链", "采购", "市场")),
    ("运营", ("运营", "内容", "新媒体")),
    ("项目", ("项目经理", "项目协调", "综合事务", "行政")),
    ("技术", ("后端", "前端", "开发", "算法", "测试", "运维", "软件", "数据分析", "工程师")),
)

_ROLE_QUESTIONS: dict[str, tuple[str, str]] = {
    "护理": ("请结合一次护理实践，说明你如何核对患者身份、观察风险并按职责及时报告？", "交接班时如何确认待办事项和患者信息，避免遗漏？"),
    "药学": ("请结合已有药学实践，说明你如何核对用药信息并记录需要进一步确认的问题？", "向患者解释用药安排时，如何确认理解并处理超出职责范围的疑问？"),
    "教学": ("请结合一次教学实践，说明你如何确定学习目标并了解学生掌握情况？", "遇到学生学习差异时，如何调整任务并与家长或同事沟通？"),
    "学术": ("请结合已有研究经历，说明研究问题、采用的方法以及证据的局限？", "如何保存研究记录、复核分析结果并处理与预期不一致的发现？"),
    "产品": ("请结合一次需求判断，说明如何确认用户问题、安排优先级并设定验收条件？", "上线后如何判断方案是否解决原始问题，哪些证据会促使你调整决定？"),
    "设计": ("请结合一个设计案例，说明用户问题、方案取舍和验证过程？", "如何处理设计反馈与约束，并向协作方说明修改依据？"),
    "商业": ("请结合一次业务任务，说明目标、关键约束以及你据以作出判断的信息？", "如何核对业务数据或交付资料，并跟进风险与后续事项？"),
    "运营": ("请结合一次运营实践，说明目标人群、执行安排和结果的评估口径？", "如何根据用户反馈调整内容或活动，并区分实际效果与其他因素的影响？"),
    "项目": ("请结合一次协调任务，说明如何拆分计划、跟进进度并处理风险？", "范围或时间发生变化时，如何与相关方确认影响和后续安排？"),
    "技术": ("请结合一个实际项目，说明问题、方案选择、验证方法和个人职责？", "遇到故障或异常结果时，如何收集证据、定位原因并确认修复效果？"),
    "通用": ("请结合一项已有经历，说明任务目标、个人职责和完成过程？", "如何确认交付要求，并在遇到风险或信息不足时及时沟通？"),
}


def _role_category(job_title: str, resume_content: str) -> str:
    for source in (job_title or "", resume_content or ""):
        for category, cues in _ROLE_CUES:
            if any(cue.casefold() in source.casefold() for cue in cues):
                return category
    return "通用"


def interview_questions_local(job_title: str, resume_content: str) -> list[str]:
    category = _role_category(job_title, resume_content)
    title = _normalize(job_title) or "该岗位"
    questions = [
        f"请用 2 分钟介绍你与{title}相关的核心经历，并说明你实际承担的职责。",
        *_ROLE_QUESTIONS[category],
        "请描述一次与他人意见不一致的经历，你依据什么信息沟通并作出决定？",
    ]
    for skill in extract_skills(resume_content)[:3]:
        questions.append(f"简历中提到了{skill}，请结合真实经历说明使用方法、个人职责和结果。")
    questions.extend([
        "回顾最近一项工作或实践，哪些结果有可靠证据，哪些地方还需要改进？",
        "针对目标岗位，你下一步希望补充哪些能力，将如何安排学习或实践？",
    ])
    return questions[:10]
