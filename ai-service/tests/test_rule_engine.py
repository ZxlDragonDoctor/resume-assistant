"""Fact preservation and role relevance regressions for offline AI rules."""
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import rule_engine as rules


class OptimizeBulletTests(unittest.TestCase):
    def test_keeps_responsibility_level(self):
        self.assertEqual(rules.optimize_bullet_local("产品经理", "负责需求整理，参与用户访谈"), "负责需求整理，参与用户访谈")

    def test_returns_only_applicable_content(self):
        result = rules.optimize_bullet_local("护士", "参与交接班核对，提升信息完整性。")
        self.assertEqual(result, "参与交接班核对，提升信息完整性。")

    def test_preserves_leading_calendar_year_and_numbers(self):
        result = rules.optimize_bullet_local("运营", "2024 年参与活动，覆盖 120 人，转化率 8%。")
        self.assertEqual(result, "2024 年参与活动，覆盖 120 人，转化率 8%。")

    def test_strips_list_markers_without_strengthening_claims(self):
        self.assertEqual(rules.optimize_bullet_local("助理", "1. 参与了资料核对\n- 负责了会议记录"), "参与资料核对\n负责会议记录")

    def test_does_not_prefix_unknown_actions(self):
        self.assertEqual(rules.optimize_bullet_local("研究助理", "在导师指导下完成实验记录"), "在导师指导下完成实验记录")

    def test_empty_content_does_not_return_instruction_as_resume_text(self):
        self.assertEqual(rules.optimize_bullet_local("", "  \n"), "")

    def test_decimal_and_signed_metrics_are_not_list_markers(self):
        for content in ("1.5年参与项目维护", "30.5%的响应来自复访", "-20%为当期同比变化"):
            with self.subTest(content=content):
                self.assertEqual(rules.optimize_bullet_local("", content), content)


class SkillExtractionTests(unittest.TestCase):
    def test_javascript_does_not_imply_java(self):
        self.assertEqual(rules.extract_skills("JavaScript"), ["JavaScript"])

    def test_go_is_not_a_substring_match(self):
        skills = rules.extract_skills("Django MongoDB Google English")
        self.assertNotIn("Go", skills)
        self.assertIn("Django", skills)
        self.assertIn("MongoDB", skills)

    def test_overlapping_terms_are_counted_once(self):
        self.assertEqual(rules.extract_skills("Spring Boot"), ["Spring Boot"])
        self.assertEqual(rules.extract_skills("MyBatis-Plus"), ["MyBatis-Plus"])
        self.assertEqual(rules.extract_skills("React Native"), ["React Native"])

    def test_separately_mentioned_parent_skill_is_retained(self):
        self.assertEqual(set(rules.extract_skills("Spring Boot 与 Spring")), {"Spring Boot", "Spring"})

    def test_aliases_share_one_skill(self):
        self.assertEqual(rules.extract_skills("Golang、Go、go"), ["Go"])
        self.assertEqual(set(rules.extract_skills("JS/JavaScript，Postgres/PostgreSQL，vue.js/Vue3")), {"JavaScript", "PostgreSQL", "Vue"})

    def test_ascii_boundaries_avoid_git_and_r_inside_other_words(self):
        self.assertEqual(rules.extract_skills("digital copyright brand"), [])

    def test_non_technical_skills_are_recognized(self):
        for text, expected in [
            ("用户访谈与需求优先级", {"用户访谈", "需求优先级"}),
            ("Figma 信息架构与可用性测试", {"Figma", "信息架构", "可用性测试"}),
            ("Excel CRM 合同核对", {"Excel", "CRM", "合同核对"}),
            ("文献检索、实验设计、R/tidyverse", {"文献检索", "实验设计", "R", "tidyverse"}),
            ("护理评估、手卫生、患者沟通", {"护理评估", "手卫生", "患者沟通"}),
        ]:
            with self.subTest(text=text):
                self.assertTrue(expected.issubset(rules.extract_skills(text)))


class YearsAndEducationTests(unittest.TestCase):
    def test_calendar_years_are_not_experience(self):
        for text in ("2024 年本科毕业", "2020年9月入学，2024年6月毕业", "1999年出生", "本科四年制"):
            with self.subTest(text=text):
                self.assertIsNone(rules.extract_years(text))

    def test_year_ranges_support_typographic_dashes(self):
        for text in ("3-5 年工作经验", "3–5年经验", "3—5年", "3~5年", "3至5年"):
            with self.subTest(text=text):
                self.assertEqual(rules.extract_years(text), "3-5年")

    def test_exact_years_do_not_become_lower_bound(self):
        self.assertEqual(rules.extract_years("具有 3 年 Java 开发经验"), "3年")

    def test_upper_bounds_do_not_become_lower_bounds(self):
        self.assertEqual(rules.extract_years("工作经验1年以内"), "1年以内")
        self.assertEqual(rules.extract_years("最多2年工作经验"), "2年以内")

    def test_lower_bounds_are_preserved(self):
        self.assertEqual(rules.extract_years("至少3年工作经验"), "3年以上")
        self.assertEqual(rules.extract_years("5年及以上开发经验"), "5年以上")

    def test_chinese_and_decimal_years(self):
        self.assertEqual(rules.extract_years("三年护理工作经验"), "3年")
        self.assertEqual(rules.extract_years("1.5年产品经验"), "1.5年")

    def test_unreasonable_or_inverted_ranges_are_ignored(self):
        for text in ("2024年工作经验", "61年经验", "5-3年经验", "3-2024年经验"):
            with self.subTest(text=text):
                self.assertIsNone(rules.extract_years(text))

    def test_graduate_and_unrestricted_experience(self):
        self.assertEqual(rules.extract_years("欢迎应届毕业生"), "应届")
        self.assertEqual(rules.extract_years("工作经验不限"), "经验不限")

    def test_education_uses_required_minimum_not_preferred_degree(self):
        self.assertEqual(rules.extract_education("本科及以上，硕士优先"), "本科")
        self.assertEqual(rules.extract_education("硕士优先，本科及以上学历"), "本科")
        self.assertEqual(rules.extract_education("本科或硕士学历"), "本科")

    def test_preferred_education_is_not_a_mandatory_requirement(self):
        self.assertIsNone(rules.extract_education("学历不限，硕士优先"))
        self.assertIsNone(rules.extract_education("硕士优先"))

    def test_adjacent_preference_does_not_remove_required_degree(self):
        self.assertEqual(rules.extract_education("本科及以上学历硕士优先"), "本科")

    def test_project_duration_and_study_duration_are_not_work_tenure(self):
        self.assertEqual(rules.extract_years("项目周期1年，实际有3年工作经验"), "3年")
        self.assertIsNone(rules.extract_years("研究生三年，完成学位论文"))

    def test_less_than_one_year_is_an_upper_bound(self):
        self.assertEqual(rules.extract_years("工作经验不足1年"), "1年以内")


class SummaryTests(unittest.TestCase):
    def test_medical_summary_has_no_invented_engineer_or_years(self):
        summary = rules.generate_summary_local("临床护士，2024年护理学本科毕业。参与护理评估和患者沟通。")
        self.assertIn("护理", summary)
        for invented in ("工程师", "熟练", "2024年以上", "核心模块", "技术方案", "代码质量"):
            self.assertNotIn(invented, summary)

    def test_product_summary_does_not_invent_engineering_claims(self):
        summary = rules.generate_summary_local("产品经理。本科学历。参与用户访谈和需求优先级讨论。")
        self.assertIn("产品", summary)
        self.assertNotIn("工程师", summary)
        self.assertNotIn("熟练掌握", summary)

    def test_sparse_facts_do_not_gain_default_skills_or_strengths(self):
        summary = rules.generate_summary_local("应届毕业生，本科。参加校园志愿活动。")
        self.assertIn("本科", summary)
        for invented in ("技术从业者", "软件", "熟练", "核心模块", "具备良好的", "年相关经验"):
            self.assertNotIn(invented, summary)

    def test_years_are_not_rounded_up(self):
        summary = rules.generate_summary_local("产品助理，有1年以内工作经验，参与验收用例整理。")
        self.assertIn("1年以内", summary)
        self.assertNotIn("1年以上", summary)

    def test_structured_editor_input_summarizes_experience_not_prompt_or_basic_heading(self):
        source = """目标岗位：B 端产品经理

现有简历内容：
## 基本信息
B 端产品经理
## 工作经历
- 远树协作科技 · 产品经理 (2023-10 - 至今)
  - 参与了客户访谈，整理 20 份反馈。
  - 围绕审批追踪难题补齐状态和催办规则，并按两期交付。
## 产品技能
- 发现问题
  - 用户访谈与工单归类
"""
        summary = rules.generate_summary_local(source)
        self.assertIn("参与了客户访谈", summary)
        self.assertIn("补齐状态和催办规则", summary)
        self.assertNotIn("目标岗位", summary)
        self.assertNotIn("现有简历内容", summary)
        self.assertNotIn("B 端产品经理", summary)

    def test_empty_summary_is_empty_content(self):
        self.assertEqual(rules.generate_summary_local(""), "")


class AtsAndInterviewTests(unittest.TestCase):
    def test_quantification_requires_a_numeric_measure(self):
        for text in ("提升稳定性", "降低成本", "优化工作流程", "2024年本科毕业"):
            with self.subTest(text=text):
                self.assertFalse(rules._has_quantification(text))
        for text in ("延迟降低30%", "核对40份记录", "覆盖120名用户", "从800ms降至120ms"):
            with self.subTest(text=text):
                self.assertTrue(rules._has_quantification(text))

    def test_unrelated_skills_do_not_improve_jd_skill_score(self):
        jd = "本科，3年以上Java开发经验，掌握Java Spring Boot"
        base = "本科，3年工作经验，使用Java完成开发。"
        extra = base + " Figma Excel CRM Photoshop Python Tableau Git Linux Word"
        first = rules.ats_score_local(jd, base)
        second = rules.ats_score_local(jd, extra)
        self.assertEqual(first["scores"]["skills"], second["scores"]["skills"])
        self.assertEqual(first["scores"]["skills"], 50)

    def test_experience_is_compared_with_jd_requirement(self):
        jd = "本科，5年以上Java开发经验，掌握Java"
        short = rules.ats_score_local(jd, "本科，1年Java开发经验。使用Java。")
        enough = rules.ats_score_local(jd, "本科，6年Java开发经验。使用Java。")
        self.assertLess(short["scores"]["experience"], enough["scores"]["experience"])
        self.assertTrue(any("年限" in suggestion or "经验" in suggestion for suggestion in short["suggestions"]))

    def test_graduation_date_cannot_meet_experience_requirement(self):
        result = rules.ats_score_local("3年以上护理经验，本科，护理评估", "2024年本科毕业。参与护理评估。")
        self.assertLess(result["scores"]["experience"], 80)

    def test_non_technical_ats_uses_relevant_keywords(self):
        result = rules.ats_score_local("护士，本科，护理评估和手卫生", "护理学本科，完成护理评估和手卫生核查")
        self.assertEqual(result["scores"]["skills"], 100)
        self.assertEqual(set(result["matchedSkills"]), {"护理评估", "手卫生"})
        self.assertFalse(any("技术关键词" in text for text in result["suggestions"]))

    def test_scores_are_bounded_integers(self):
        for jd, resume in (("", ""), ("护士", "护士"), ("Java", "Java " * 500)):
            result = rules.ats_score_local(jd, resume)
            self.assertEqual(result["engine"], "rule")
            for score in result["scores"].values():
                self.assertIs(type(score), int)
                self.assertTrue(0 <= score <= 100)

    def test_nursing_interview_is_about_nursing(self):
        questions = rules.interview_questions_local("临床护士", "参与护理评估和交接班核对")
        joined = " ".join(questions)
        self.assertIn("护理", joined)
        self.assertTrue("患者" in joined or "交接" in joined)
        for irrelevant in ("技术难点", "技术成长", "性能表现", "代码", "Java"):
            self.assertNotIn(irrelevant, joined)

    def test_product_interview_is_about_product_work(self):
        questions = rules.interview_questions_local("产品经理", "参与用户访谈和需求优先级评审")
        joined = " ".join(questions)
        self.assertIn("需求", joined)
        self.assertNotIn("技术成长", joined)
        self.assertNotIn("Java", joined)

    def test_interview_only_mentions_skills_in_source(self):
        joined = " ".join(rules.interview_questions_local("Java后端工程师", "使用Java维护接口"))
        self.assertIn("Java", joined)
        for invented in ("Redis", "Kafka", "Spring", "Docker"):
            self.assertNotIn(invented, joined)


CATALOG_EXPECTED = {
    "academic-research": "文献检索", "algorithm-engineer": "PyTorch",
    "brand-designer": "Illustrator", "business-analyst": "Power BI",
    "content-operations": "事实核对", "data-analyst": "SQL",
    "finance-accounting": "Excel", "general-career": "会议纪要",
    "graduate-business": "Excel", "graduate-developer": "Java",
    "graduate-general": "Word", "growth-operations": "SQL",
    "hr-specialist": "候选人沟通", "java-backend": "Java",
    "pharmacist": "文献检索", "product-manager": "需求优先级",
    "project-manager": "风险台账", "qa-engineer": "SQL",
    "registered-nurse": "护理评估", "sales-business": "CRM",
    "supply-chain": "ERP", "teacher": "家校沟通",
    "ux-designer": "Figma", "web-frontend": "JavaScript",
}


def _sample_strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from _sample_strings(item)
    elif isinstance(value, dict):
        for key, item in value.items():
            if key not in {"_config", "phone", "email", "name", "startDate", "endDate"}:
                yield from _sample_strings(item)


class CatalogRoleRegressionTests(unittest.TestCase):
    def test_all_24_role_samples_have_grounded_local_results(self):
        catalog = Path(__file__).resolve().parents[2] / "templates" / "catalog"
        paths = sorted(catalog.glob("*.json"))
        self.assertEqual(len(paths), 24)
        for path in paths:
            with self.subTest(role=path.stem):
                document = json.loads(path.read_text(encoding="utf-8"))
                sample = document["sample"]
                title = sample["profile"]["jobTitle"]
                source = "\n".join(_sample_strings([section["data"] for section in sample["sections"]]))
                expected = CATALOG_EXPECTED[path.stem]
                self.assertIn(expected, rules.extract_skills(source))
                self.assertTrue(rules.generate_summary_local(source))
                interview = rules.interview_questions_local(title, source)
                self.assertTrue(5 <= len(interview) <= 10)
                if document["category"] in {"medical", "business", "design", "academic", "product", "general"}:
                    self.assertNotIn("技术成长", " ".join(interview))
                result = rules.match_skills_local(source, expected)
                self.assertEqual(result["matchRate"], 100)
                self.assertEqual(result["engine"], "rule")
                for section in sample["sections"]:
                    for item in section["data"].get("items", []):
                        if isinstance(item, dict):
                            for bullet in item.get("bullets", []):
                                self.assertEqual(rules.optimize_bullet_local(title, bullet), bullet)


if __name__ == "__main__":
    unittest.main()
