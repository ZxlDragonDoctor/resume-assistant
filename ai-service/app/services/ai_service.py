from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from app.core.config import settings

llm = ChatOpenAI(
    api_key=settings.openai_api_key,
    base_url=settings.openai_base_url,
    model=settings.llm_model,
    temperature=0.7,
)

OPTIMIZE_BULLET_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "你是一位专业的简历优化顾问。你的任务是将用户的经历描述改写成更具吸引力的简历要点。"
     "使用STAR法则（情境-任务-行动-结果），并尽可能量化成果。"
     "回复格式：返回一条优化后的要点，不要有多余的解释。"),
    ("human", "岗位方向：{job_title}\n原始描述：{content}"),
])

GENERATE_SUMMARY_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "你是一位专业的简历顾问。根据用户提供的简历信息，生成一段简洁有力的个人总结（200字以内）。"
     "突出核心竞争力和职业目标。直接返回总结内容，不要有多余的解释。"),
    ("human", "简历信息：{resume_info}"),
])

ATS_SCORE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "你是一位专业的ATS简历评分专家。分析简历与职位描述的匹配程度。"
     "从以下维度评分（每项0-100）："
     "1. 关键词匹配度\n2. 技能匹配度\n3. 经验相关性\n4. 教育背景\n5. 整体印象"
     "返回JSON格式：{{ \"scores\": {{ \"keywords\": 0, \"skills\": 0, \"experience\": 0, \"education\": 0, \"overall\": 0 }}, "
     "\"suggestions\": [\"建议1\", \"建议2\"] }}"),
    ("human", "职位描述：{job_description}\n\n简历内容：{resume_content}"),
])


async def optimize_bullet(job_title: str, content: str) -> str:
    chain = OPTIMIZE_BULLET_PROMPT | llm
    result = await chain.ainvoke({"job_title": job_title, "content": content})
    return result.content


async def generate_summary(resume_info: str) -> str:
    chain = GENERATE_SUMMARY_PROMPT | llm
    result = await chain.ainvoke({"resume_info": resume_info})
    return result.content


async def ats_score(job_description: str, resume_content: str) -> dict:
    chain = ATS_SCORE_PROMPT | llm
    result = await chain.ainvoke({
        "job_description": job_description,
        "resume_content": resume_content,
    })
    import json
    try:
        return json.loads(result.content)
    except json.JSONDecodeError:
        return {
            "scores": {"keywords": 0, "skills": 0, "experience": 0, "education": 0, "overall": 0},
            "suggestions": [result.content],
        }
