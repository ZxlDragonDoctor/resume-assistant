"""Bounded API input and validated model output contracts."""
from typing import Annotated, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

JobTitle = Annotated[str, Field(max_length=200)]
BulletText = Annotated[str, Field(min_length=1, max_length=6000)]
ResumeText = Annotated[str, Field(min_length=1, max_length=40000)]
JdText = Annotated[str, Field(min_length=1, max_length=20000)]
ShortText = Annotated[str, Field(min_length=1, max_length=1000)]
SkillText = Annotated[str, Field(min_length=1, max_length=200)]
Score = Annotated[int, Field(strict=True, ge=0, le=100)]


class RequestModel(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", str_strip_whitespace=True)


class OptimizeRequest(RequestModel):
    job_title: JobTitle = ""
    content: BulletText


class SummaryRequest(RequestModel):
    resume_info: ResumeText


class AtsRequest(RequestModel):
    job_description: Annotated[str, Field(max_length=20000)] = ""
    resume_content: ResumeText


class JdParseRequest(RequestModel):
    job_description: JdText


class TranslateRequest(RequestModel):
    content: ResumeText
    target_lang: Literal["en", "zh"] = "en"


class InterviewRequest(RequestModel):
    job_title: JobTitle = ""
    resume_content: ResumeText


class MatchSkillsRequest(RequestModel):
    resume_content: ResumeText
    job_description: JdText


class BatchBullet(RequestModel):
    # The original text is the editor's optimistic concurrency token.
    model_config = ConfigDict(strict=True, extra="forbid", str_strip_whitespace=False)
    id: Annotated[str, Field(min_length=1, max_length=200)]
    content: BulletText

    @field_validator("id", "content")
    @classmethod
    def non_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("内容不能为空")
        return value


class OptimizeBulletsRequest(RequestModel):
    job_title: JobTitle = ""
    bullets: Annotated[list[BatchBullet], Field(min_length=1, max_length=30)]

    @model_validator(mode="after")
    def unique_bounded_bullets(self):
        if len({item.id for item in self.bullets}) != len(self.bullets):
            raise ValueError("条目 ID 不能重复")
        if sum(len(item.content) for item in self.bullets) > 60000:
            raise ValueError("批量内容过长")
        return self


class ModelOutput(BaseModel):
    # Ignore unknown provider fields, but never send them back to clients.
    model_config = ConfigDict(strict=True, extra="ignore", str_strip_whitespace=True)


class TextOutput(ModelOutput):
    result: ResumeText


class AtsScores(ModelOutput):
    keywords: Score
    skills: Score
    experience: Score
    education: Score
    overall: Score


class AtsOutput(ModelOutput):
    scores: AtsScores
    suggestions: Annotated[list[ShortText], Field(min_length=1, max_length=20)]
    matchedSkills: Annotated[list[SkillText], Field(max_length=100)]
    missingSkills: Annotated[list[SkillText], Field(max_length=100)]


class JdOutput(ModelOutput):
    skills: Annotated[list[SkillText], Field(max_length=100)]
    years: Annotated[str, Field(min_length=1, max_length=100)] | None
    education: Annotated[str, Field(min_length=1, max_length=100)] | None
    responsibilities: Annotated[list[ShortText], Field(max_length=30)]
    requirements: Annotated[list[ShortText], Field(max_length=30)]


class BatchModelItem(ModelOutput):
    id: Annotated[str, Field(min_length=1, max_length=200)]
    after: BulletText
    suggestions: Annotated[list[ShortText], Field(max_length=10)] = Field(default_factory=list)


class BatchModelOutput(ModelOutput):
    items: Annotated[list[BatchModelItem], Field(min_length=1, max_length=30)]


class InterviewOutput(ModelOutput):
    questions: Annotated[list[ShortText], Field(min_length=3, max_length=10)]


class ResultMeta(ModelOutput):
    engine: Literal["llm", "rule", "none"]
    notice: Annotated[str, Field(max_length=1000)] | None = None
    fallbackReason: Literal["unconfigured", "timeout", "invalid_output", "provider_error"] | None = None


class TextResponse(ResultMeta):
    result: Annotated[str, Field(max_length=40000)]
    suggestions: Annotated[list[ShortText], Field(max_length=20)] = Field(default_factory=list)


class AtsResponse(AtsOutput, ResultMeta):
    pass


class JdResponse(JdOutput, ResultMeta):
    pass


class InterviewResponse(InterviewOutput, ResultMeta):
    pass


class BatchResultItem(ModelOutput):
    model_config = ConfigDict(strict=True, extra="ignore", str_strip_whitespace=False)
    id: Annotated[str, Field(min_length=1, max_length=200)]
    before: BulletText
    after: BulletText
    engine: Literal["llm", "rule"]
    suggestions: Annotated[list[ShortText], Field(max_length=10)] = Field(default_factory=list)


class BatchResponse(ResultMeta):
    items: Annotated[list[BatchResultItem], Field(min_length=1, max_length=30)]


class MatchSkillsResponse(ResultMeta):
    matched: Annotated[list[SkillText], Field(max_length=100)]
    missing: Annotated[list[SkillText], Field(max_length=100)]
    extra: Annotated[list[SkillText], Field(max_length=100)]
    matchRate: Score


class HealthResponse(ModelOutput):
    status: Literal["ok"]
    llmEnabled: bool
    engine: Literal["llm", "rule"]
    modelStatus: Literal["unconfigured", "configured", "available", "unavailable"]


DataT = TypeVar("DataT")


class SuccessResponse(ModelOutput, Generic[DataT]):
    code: Literal[200]
    message: Literal["success"]
    data: DataT
