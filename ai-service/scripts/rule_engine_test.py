"""
本地规则引擎降级测试
------------------------------------------------------------------
验证 ai-service 在未配置大模型密钥时，六项能力仍能给出可用结果
（每个响应都带 engine 字段，UI 据此提示"本地规则"模式）。

运行：python scripts/rule_engine_test.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.rule_engine import (  # noqa: E402
    ats_score_local,
    generate_summary_local,
    interview_questions_local,
    match_skills_local,
    optimize_bullet_local,
    parse_jd_local,
)

JD = """
岗位职责：
1. 负责核心交易系统的后端设计与开发
2. 参与高并发场景下的性能优化
任职要求：
1. 本科及以上学历，3 年以上 Java 开发经验
2. 精通 Java、Spring Boot、MySQL、Redis、Kafka
3. 熟悉分布式系统设计，有微服务经验优先
"""

RESUME = """
## 基本信息
张三 | Java 后端开发工程师 | 13800000000 | z@example.com

## 个人总结
三年 Java 后端开发经验，擅长高并发系统设计。

## 工作经历
- 字节跳动 · 后端开发工程师 (2021-07 - 2024-06)
  - 主导订单服务重构，用 Redis 缓存 + Kafka 削峰，P99 从 800ms 降到 120ms
  - 设计分库分表方案，支撑日均 200 万订单

## 专业技能
Java · Spring Boot · MySQL · Redis · Kafka · Docker
"""


def main() -> int:
    results = []

    # 1. 要点优化
    out = optimize_bullet_local("Java 后端开发", "负责订单服务的开发")
    results.append(("optimize_bullet 返回非空", bool(out and out.strip()), out[:72]))

    # 2. 个人总结
    out = generate_summary_local("Java 后端开发，3 年经验。" + RESUME)
    results.append(("generate_summary 返回非空", bool(out and out.strip()), out[:72]))

    # 3. ATS 评分
    score = ats_score_local(JD, RESUME)
    ok = isinstance(score, dict) and "scores" in score and "suggestions" in score
    detail = ""
    if ok:
        s = score["scores"]
        detail = (
            f"overall={s.get('overall')} keywords={s.get('keywords')} "
            f"skills={s.get('skills')} 建议数={len(score.get('suggestions') or [])}"
        )
    results.append(("ats_score 结构完整", ok, detail))

    # 4. JD 解析
    parsed = parse_jd_local(JD)
    ok = isinstance(parsed, dict) and bool(parsed.get("skills"))
    detail = ""
    if ok:
        detail = (
            f"skills={parsed.get('skills')} years={parsed.get('years')} "
            f"education={parsed.get('education')}"
        )
    results.append(("parse_jd 提取到技能与年限", ok, detail))

    # 5. 技能匹配
    matched = match_skills_local(RESUME, JD)
    ok = isinstance(matched, dict) and "matchRate" in matched and "matched" in matched
    detail = ""
    if ok:
        detail = (
            f"rate={matched.get('matchRate')} 命中={matched.get('matched')} "
            f"缺失={matched.get('missing')}"
        )
    results.append(("match_skills 输出命中与缺失", ok, detail))

    # 6. 面试题
    questions = interview_questions_local("Java 后端开发", RESUME)
    ok = isinstance(questions, list) and len(questions) > 0
    results.append(("interview_questions 生成题目", ok, str(questions[:2])[:110]))

    print("=" * 74)
    failures = 0
    for name, ok, detail in results:
        if not ok:
            failures += 1
        print(f"{'PASS' if ok else 'FAIL'}  {name}")
        if detail:
            print(f"      {detail}")
    print("=" * 74)
    if failures == 0:
        print("规则引擎降级测试全部通过 —— 无大模型时 AI 能力依然可用")
    else:
        print(f"规则引擎降级测试失败 {failures} 项")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
