package com.zxl.resume.resume.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zxl.resume.resume.dto.*;
import com.zxl.resume.resume.entity.Resume;
import com.zxl.resume.resume.entity.ResumeSection;
import com.zxl.resume.resume.entity.ResumeVersion;
import com.zxl.resume.resume.repository.ResumeMapper;
import com.zxl.resume.resume.repository.ResumeVersionMapper;
import com.zxl.resume.resume.repository.SectionMapper;
import com.zxl.resume.resume.repository.TemplateCategoryMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ResumeService {

    private final ResumeMapper resumeMapper;
    private final SectionMapper sectionMapper;
    private final ResumeVersionMapper versionMapper;
    private final TemplateCategoryMapper templateCategoryMapper;
    private final ObjectMapper objectMapper;

    private static final String TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    // ---------------------------------------------------------------
    // 查询
    // ---------------------------------------------------------------

    public List<Resume> listByUser(UUID userId) {
        return resumeMapper.selectList(
                new LambdaQueryWrapper<Resume>()
                        .eq(Resume::getUserId, userId)
                        .orderByDesc(Resume::getUpdatedAt));
    }

    public ResumeDetailResponse getDetail(UUID id, UUID userId) {
        Resume resume = resumeMapper.selectById(id);
        if (resume == null || !resume.getUserId().equals(userId)) {
            throw new IllegalArgumentException("简历不存在或无权访问");
        }
        return toDetail(resume);
    }

    /** 通过分享令牌读取（只读，不校验用户） */
    public ResumeDetailResponse getSharedDetail(String token) {
        Resume resume = resumeMapper.findByShareToken(token);
        if (resume == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.NOT_FOUND, "分享链接无效或已关闭");
        }
        resumeMapper.incrementViewCount(resume.getId());
        return toDetail(resume);
    }

    private ResumeDetailResponse toDetail(Resume resume) {
        ResumeDetailResponse resp = new ResumeDetailResponse();
        resp.setId(resume.getId());
        resp.setTitle(resume.getTitle());
        resp.setTemplateId(resume.getTemplateId());
        resp.setTargetJob(resume.getTargetJob());
        resp.setTargetCompany(resume.getTargetCompany());
        resp.setFontFamily(resume.getFontFamily());
        resp.setFontSize(resume.getFontSize());
        resp.setThemeColor(resume.getThemeColor());
        resp.setLineSpacing(resume.getLineSpacing());
        resp.setLayoutConfig(resume.getLayoutConfig());
        resp.setShareEnabled(resume.getShareEnabled());
        resp.setShareToken(resume.getShareToken());
        resp.setViewCount(resume.getViewCount());
        resp.setStatus(resume.getStatus());
        resp.setCreatedAt(resume.getCreatedAt());
        resp.setUpdatedAt(resume.getUpdatedAt());

        List<ResumeSection> sections = sectionMapper.findByResumeIdOrdered(resume.getId());
        resp.setSections(sections.stream().map(s -> {
            ResumeDetailResponse.SectionResponse sr = new ResumeDetailResponse.SectionResponse();
            sr.setId(s.getId());
            sr.setSectionType(s.getSectionType());
            sr.setSortOrder(s.getSortOrder());
            sr.setIsVisible(s.getIsVisible());
            sr.setLayout(s.getLayout());
            sr.setData(parseJsonNode(s.getData()));
            return sr;
        }).collect(Collectors.toList()));
        return resp;
    }

    /** 将 JSONB 字符串解析为 JsonNode，前端可直接消费；解析失败则原样返回 */
    private Object parseJsonNode(String raw) {
        if (raw == null || raw.isBlank()) return Map.of();
        try {
            JsonNode node = objectMapper.readTree(raw);
            return node;
        } catch (JsonProcessingException e) {
            return raw;
        }
    }

    // ---------------------------------------------------------------
    // 创建 / 删除
    // ---------------------------------------------------------------

    @Transactional
    public Resume create(UUID userId, CreateResumeRequest req) {
        Resume resume = new Resume();
        resume.setId(UUID.randomUUID());
        resume.setUserId(userId);
        resume.setTitle(req.getTitle());
        resume.setTemplateId(req.getTemplateId());
        resume.setIsPublic(false);
        resume.setShareEnabled(false);
        resume.setViewCount(0);
        resume.setStatus("draft");
        resume.setFontFamily("system-ui");
        resume.setFontSize(14);
        resume.setThemeColor("#2563eb");
        resume.setLineSpacing(1.6);
        resume.setLayoutConfig("{}");
        resumeMapper.insert(resume);

        // 打开模板/新建简历时预置示例内容，用户可直接在样例上修改
        seedSampleSections(resume.getId(), req.getTemplateId());

        return resume;
    }

    /**
     * 预置可编辑示例简历。
     * 按模板 category 切换不同行业样例，打开模板即可直接改；无模板时用通用研发样例。
     * 人名/联系方式均为虚构占位。
     */
    private void seedSampleSections(UUID resumeId, UUID templateId) {
        String category = null;
        if (templateId != null) {
            try {
                category = sectionMapper != null ? findTemplateCategory(templateId) : null;
            } catch (Exception ignored) {
                category = null;
            }
        }
        if (category == null) category = "modern";

        switch (category) {
            case "business":
            case "classic":
                seedBusinessSample(resumeId);
                break;
            case "creative":
            case "design":
            case "product":
                seedProductSample(resumeId);
                break;
            case "academic":
            case "education":
                seedAcademicSample(resumeId);
                break;
            case "graduate":
                seedGraduateSample(resumeId);
                break;
            case "data":
                seedDataSample(resumeId);
                break;
            case "medical":
                seedMedicalSample(resumeId);
                break;
            default:
                seedTechSample(resumeId);
        }
    }

    private String findTemplateCategory(UUID templateId) {
        return templateCategoryMapper.findCategoryById(templateId);
    }

    /** 研发 / 通用 */
    private void seedTechSample(UUID resumeId) {
        insertSection(resumeId, "basic", 0, "single-column",
                "{\"name\":\"张小北\",\"phone\":\"138****0000\",\"email\":\"zhangxb@example.com\","
                        + "\"city\":\"杭州\",\"jobTitle\":\"Java 后端开发工程师\",\"links\":[],\"_config\":{}}");
        insertSection(resumeId, "summary", 1, "single-column",
                "{\"content\":\"计算机专业本科，3 年 Java 后端开发经验。熟悉 Spring Cloud 微服务架构，"
                        + "主导过日均 20w+ 的订单系统重构，将核心接口 P99 延迟从 850ms 降至 120ms。"
                        + "关注系统稳定性与可维护性，善于把业务问题拆成可落地的技术方案。\",\"_config\":{}}");
        insertSection(resumeId, "experience", 2, "single-column",
                "{\"items\":["
                        + "{\"company\":\"某互联网科技公司\",\"position\":\"后端开发工程师\","
                        + "\"startDate\":\"2023-07\",\"endDate\":\"\",\"current\":true,\"bullets\":["
                        + "\"主导订单服务重构，引入本地消息表 + 定时补偿，解决分布式事务数据不一致问题，日均修复异常订单 200+\","
                        + "\"设计多级缓存方案（Caffeine + Redis），核心接口 P99 延迟由 850ms 降至 120ms，QPS 提升 4 倍\","
                        + "\"推动接口幂等与限流组件落地，大促期间系统零故障\"]},"
                        + "{\"company\":\"某软件公司\",\"position\":\"Java 开发实习生\","
                        + "\"startDate\":\"2022-07\",\"endDate\":\"2023-06\",\"current\":false,\"bullets\":["
                        + "\"参与后台管理系统开发，负责权限与报表模块，交付 12 个接口并覆盖单测\","
                        + "\"优化 SQL 查询与分页逻辑，列表页加载时间从 1.8s 降到 600ms\"]}"
                        + "],\"_config\":{}}");
        insertSection(resumeId, "projects", 3, "single-column",
                "{\"items\":["
                        + "{\"name\":\"分布式任务调度平台\",\"role\":\"核心开发\","
                        + "\"tech\":\"Spring Boot · Redis · PostgreSQL\","
                        + "\"startDate\":\"2023-01\",\"endDate\":\"2023-06\",\"current\":false,\"bullets\":["
                        + "\"设计任务分片与失败重试机制，支撑 5000+ 任务稳定调度\","
                        + "\"实现可视化执行日志与告警，问题定位时间从小时级降到分钟级\"]},"
                        + "{\"name\":\"开源社区贡献\",\"role\":\"Contributor\",\"tech\":\"Java · GitHub Actions\","
                        + "\"startDate\":\"2022-03\",\"endDate\":\"2022-12\",\"current\":false,\"bullets\":["
                        + "\"修复 3 个高优 issue 并补齐回归测试，被合并进主分支\"]}"
                        + "],\"_config\":{}}");
        insertSection(resumeId, "education", 4, "single-column",
                "{\"items\":[{\"school\":\"某大学\",\"degree\":\"本科\",\"major\":\"计算机科学与技术\","
                        + "\"startDate\":\"2017-09\",\"endDate\":\"2021-06\",\"current\":false}],\"_config\":{}}");
        insertSection(resumeId, "skills", 5, "single-column",
                "{\"items\":[\"Java\",\"Spring Boot\",\"Spring Cloud\",\"MySQL\",\"Redis\",\"Kafka\",\"Docker\",\"Linux\"],\"_config\":{}}");
    }

    /** 商务 / 金融 / 管理 */
    private void seedBusinessSample(UUID resumeId) {
        insertSection(resumeId, "basic", 0, "single-column",
                "{\"name\":\"李思远\",\"phone\":\"139****1111\",\"email\":\"lisiyuan@example.com\","
                        + "\"city\":\"上海\",\"jobTitle\":\"商业分析师\",\"links\":[],\"_config\":{}}");
        insertSection(resumeId, "summary", 1, "single-column",
                "{\"content\":\"5 年咨询与商业分析经验，服务过金融、快消与制造行业客户。"
                        + "擅长从经营数据中提炼可执行策略，主导过 3 个千万级营收优化项目。"
                        + "沟通表达清晰，能同时对接业务负责人与数据团队。\",\"_config\":{}}");
        insertSection(resumeId, "experience", 2, "single-column",
                "{\"items\":[{\"company\":\"某管理咨询公司\",\"position\":\"高级商业分析师\","
                        + "\"startDate\":\"2021-03\",\"endDate\":\"\",\"current\":true,\"bullets\":["
                        + "\"牵头某快消品牌渠道效率诊断，提出结构优化方案，年化节省成本约 1200 万\","
                        + "\"搭建经营分析看板与月度复盘机制，业务决策响应周期缩短 40%\","
                        + "\"带领 3 人小组完成 6 个行业对标研究，支撑客户新业务立项\"]}],\"_config\":{}}");
        insertSection(resumeId, "education", 3, "single-column",
                "{\"items\":[{\"school\":\"某大学\",\"degree\":\"硕士\",\"major\":\"工商管理\","
                        + "\"startDate\":\"2016-09\",\"endDate\":\"2018-06\",\"current\":false}],\"_config\":{}}");
        insertSection(resumeId, "skills", 4, "single-column",
                "{\"items\":[\"商业分析\",\"财务建模\",\"Excel/SQL\",\"行业研究\",\"项目管理\",\"公开演讲\"],\"_config\":{}}");
    }

    /** 产品 / 设计 / 创意 */
    private void seedProductSample(UUID resumeId) {
        insertSection(resumeId, "basic", 0, "single-column",
                "{\"name\":\"王一诺\",\"phone\":\"137****2222\",\"email\":\"wangyinuo@example.com\","
                        + "\"city\":\"北京\",\"jobTitle\":\"产品经理\",\"links\":[],\"_config\":{}}");
        insertSection(resumeId, "summary", 1, "single-column",
                "{\"content\":\"4 年互联网产品经验，主导过用户增长与交易链路改版。"
                        + "以数据驱动迭代，擅长需求拆解、跨部门协同与上线后复盘。"
                        + "曾将核心转化率提升 18%，用户次日留存提升 9 个百分点。\",\"_config\":{}}");
        insertSection(resumeId, "projects", 2, "single-column",
                "{\"items\":[{\"name\":\"交易链路改版\",\"role\":\"产品负责人\","
                        + "\"tech\":\"用户研究 · A/B 测试 · 数据分析\","
                        + "\"startDate\":\"2023-02\",\"endDate\":\"2023-11\",\"current\":false,\"bullets\":["
                        + "\"梳理 23 个关键触点漏斗，定位 4 处流失高峰并推动改版\","
                        + "\"上线后支付转化率 +18%，客诉率 -25%\"]}],\"_config\":{}}");
        insertSection(resumeId, "experience", 3, "single-column",
                "{\"items\":[{\"company\":\"某互联网公司\",\"position\":\"高级产品经理\","
                        + "\"startDate\":\"2021-06\",\"endDate\":\"\",\"current\":true,\"bullets\":["
                        + "\"负责增长方向，季度拉新成本下降 22%，新增用户 +35%\","
                        + "\"建立需求优先级评估模型，迭代吞吐提升 30%\"]}],\"_config\":{}}");
        insertSection(resumeId, "education", 4, "single-column",
                "{\"items\":[{\"school\":\"某大学\",\"degree\":\"本科\",\"major\":\"信息管理与信息系统\","
                        + "\"startDate\":\"2015-09\",\"endDate\":\"2019-06\",\"current\":false}],\"_config\":{}}");
        insertSection(resumeId, "skills", 5, "single-column",
                "{\"items\":[\"需求分析\",\"用户研究\",\"数据分析\",\"Figma\",\"Axure\",\"项目管理\"],\"_config\":{}}");
    }

    /** 学术 / 教育 */
    private void seedAcademicSample(UUID resumeId) {
        insertSection(resumeId, "basic", 0, "single-column",
                "{\"name\":\"陈知夏\",\"phone\":\"136****3333\",\"email\":\"chenzhixia@example.com\","
                        + "\"city\":\"南京\",\"jobTitle\":\"科研助理 / 申请者\",\"links\":[],\"_config\":{}}");
        insertSection(resumeId, "education", 1, "single-column",
                "{\"items\":[{\"school\":\"某大学\",\"degree\":\"硕士\",\"major\":\"计算机应用技术\","
                        + "\"startDate\":\"2021-09\",\"endDate\":\"2024-06\",\"current\":false}],\"_config\":{}}");
        insertSection(resumeId, "summary", 2, "single-column",
                "{\"content\":\"研究方向为机器学习与自然语言处理，发表会议论文 2 篇。"
                        + "具备完整科研训练：文献调研、实验设计、论文写作与学术报告。"
                        + "希望在工业界或继续深造中从事算法相关工作。\",\"_config\":{}}");
        insertSection(resumeId, "projects", 3, "single-column",
                "{\"items\":[{\"name\":\"文本分类与信息抽取研究\",\"role\":\"第一作者\","
                        + "\"tech\":\"PyTorch · Transformers · Python\","
                        + "\"startDate\":\"2022-03\",\"endDate\":\"2023-12\",\"current\":false,\"bullets\":["
                        + "\"提出融合领域词表的微调策略，在公开数据集上 F1 提升 3.2 个点\","
                        + "\"完成实验复现、消融分析与论文撰写，投稿至 CCF-B 会议\"]}],\"_config\":{}}");
        insertSection(resumeId, "skills", 4, "single-column",
                "{\"items\":[\"Python\",\"PyTorch\",\"机器学习\",\"论文写作\",\"LaTeX\",\"学术报告\"],\"_config\":{}}");
    }

    /** 应届 / 实习 */
    private void seedGraduateSample(UUID resumeId) {
        insertSection(resumeId, "basic", 0, "single-column",
                "{\"name\":\"赵晓阳\",\"phone\":\"135****4444\",\"email\":\"zhaoxiaoyang@example.com\","
                        + "\"city\":\"武汉\",\"jobTitle\":\"Java 开发工程师（应届）\",\"links\":[],\"_config\":{}}");
        insertSection(resumeId, "education", 1, "single-column",
                "{\"items\":[{\"school\":\"某大学\",\"degree\":\"本科\",\"major\":\"软件工程\","
                        + "\"startDate\":\"2020-09\",\"endDate\":\"2024-06\",\"current\":false}],\"_config\":{}}");
        insertSection(resumeId, "summary", 2, "single-column",
                "{\"content\":\"软件工程专业应届生，专业排名前 15%。有两段实习经历，"
                        + "熟悉 Java 技术栈与常用中间件。做过 2 个完整课程/开源项目，"
                        + "代码规范、文档完整，希望加入后端研发团队持续成长。\",\"_config\":{}}");
        insertSection(resumeId, "projects", 3, "single-column",
                "{\"items\":[{\"name\":\"校园二手交易平台\",\"role\":\"全栈开发\","
                        + "\"tech\":\"Spring Boot · Vue · MySQL\","
                        + "\"startDate\":\"2023-03\",\"endDate\":\"2023-06\",\"current\":false,\"bullets\":["
                        + "\"实现发布、检索、下单与消息通知全流程，覆盖 500+ 校内用户测试\","
                        + "\"使用 Redis 缓存热门商品，列表接口响应 < 100ms\"]}],\"_config\":{}}");
        insertSection(resumeId, "experience", 4, "single-column",
                "{\"items\":[{\"company\":\"某科技公司\",\"position\":\"后端开发实习生\","
                        + "\"startDate\":\"2023-07\",\"endDate\":\"2023-12\",\"current\":false,\"bullets\":["
                        + "\"参与订单中台开发，交付 8 个接口并通过代码评审\","
                        + "\"编写自动化脚本提升联调效率，节省约 20% 测试时间\"]}],\"_config\":{}}");
        insertSection(resumeId, "skills", 5, "single-column",
                "{\"items\":[\"Java\",\"Spring Boot\",\"MySQL\",\"Redis\",\"Vue\",\"Git\"],\"_config\":{}}");
    }

    /** 数据分析 */
    private void seedDataSample(UUID resumeId) {
        insertSection(resumeId, "basic", 0, "single-column",
                "{\"name\":\"周明月\",\"phone\":\"134****5555\",\"email\":\"zhoumingyue@example.com\","
                        + "\"city\":\"深圳\",\"jobTitle\":\"数据分析师\",\"links\":[],\"_config\":{}}");
        insertSection(resumeId, "summary", 1, "single-column",
                "{\"content\":\"3 年数据分析经验，服务电商与内容业务。擅长指标体系搭建、"
                        + "异动归因与实验设计。用数据推动过多次运营策略优化，累计带来千万级 GMV 增量。\",\"_config\":{}}");
        insertSection(resumeId, "experience", 2, "single-column",
                "{\"items\":[{\"company\":\"某电商公司\",\"position\":\"数据分析师\","
                        + "\"startDate\":\"2021-08\",\"endDate\":\"\",\"current\":true,\"bullets\":["
                        + "\"搭建核心经营指标体系与日报/周报自动化，报表产出时效提升 70%\","
                        + "\"通过漏斗与留存分析定位转化瓶颈，推动改版后 GMV 周环比 +6%\","
                        + "\"设计并分析 20+ A/B 实验，沉淀实验规范文档\"]}],\"_config\":{}}");
        insertSection(resumeId, "skills", 3, "single-column",
                "{\"items\":[\"SQL\",\"Python\",\"Tableau\",\"Excel\",\"A/B 测试\",\"指标体系\"],\"_config\":{}}");
        insertSection(resumeId, "education", 4, "single-column",
                "{\"items\":[{\"school\":\"某大学\",\"degree\":\"本科\",\"major\":\"统计学\","
                        + "\"startDate\":\"2016-09\",\"endDate\":\"2020-06\",\"current\":false}],\"_config\":{}}");
    }

    /** 医疗健康 */
    private void seedMedicalSample(UUID resumeId) {
        insertSection(resumeId, "basic", 0, "single-column",
                "{\"name\":\"林清和\",\"phone\":\"133****6666\",\"email\":\"linqinghe@example.com\","
                        + "\"city\":\"广州\",\"jobTitle\":\"临床药师\",\"links\":[],\"_config\":{}}");
        insertSection(resumeId, "summary", 1, "single-column",
                "{\"content\":\"药学专业，5 年三甲医院临床药师经验。熟悉合理用药审核、"
                        + "药物不良反应监测与患者用药教育。参与多项合理用药改进项目，"
                        + "沟通耐心细致，能与医护团队高效协作。\",\"_config\":{}}");
        insertSection(resumeId, "certificates", 2, "single-column",
                "{\"items\":[{\"title\":\"执业药师资格证书\",\"date\":\"2020-09\"},"
                        + "{\"title\":\"主管药师职称\",\"date\":\"2022-12\"}],\"_config\":{}}");
        insertSection(resumeId, "experience", 3, "single-column",
                "{\"items\":[{\"company\":\"某三甲医院\",\"position\":\"临床药师\","
                        + "\"startDate\":\"2019-07\",\"endDate\":\"\",\"current\":true,\"bullets\":["
                        + "\"参与临床查房与用药会诊，年审核医嘱 8000+ 条\","
                        + "\"牵头抗菌药物合理使用专项，相关指标达标率提升至 95%\"]}],\"_config\":{}}");
        insertSection(resumeId, "education", 4, "single-column",
                "{\"items\":[{\"school\":\"某医科大学\",\"degree\":\"本科\",\"major\":\"药学\","
                        + "\"startDate\":\"2014-09\",\"endDate\":\"2019-06\",\"current\":false}],\"_config\":{}}");
        insertSection(resumeId, "skills", 5, "single-column",
                "{\"items\":[\"合理用药审核\",\"药物咨询\",\"不良反应监测\",\"医学文献检索\",\"沟通协作\"],\"_config\":{}}");
    }

    private void insertSection(UUID resumeId, String type, int order, String layout, String data) {
        ResumeSection s = new ResumeSection();
        s.setId(UUID.randomUUID());
        s.setResumeId(resumeId);
        s.setSectionType(type);
        s.setSortOrder(order);
        s.setIsVisible(true);
        s.setLayout(layout);
        s.setData(data);
        sectionMapper.insert(s);
    }

    @Transactional
    public UUID duplicate(UUID id, UUID userId) {
        Resume src = resumeMapper.selectById(id);
        if (src == null || !src.getUserId().equals(userId)) {
            throw new IllegalArgumentException("简历不存在或无权访问");
        }
        Resume copy = new Resume();
        copy.setId(UUID.randomUUID());
        copy.setUserId(userId);
        copy.setTitle(src.getTitle() + " 副本");
        copy.setTemplateId(src.getTemplateId());
        copy.setTargetJob(src.getTargetJob());
        copy.setTargetCompany(src.getTargetCompany());
        copy.setFontFamily(src.getFontFamily());
        copy.setFontSize(src.getFontSize());
        copy.setThemeColor(src.getThemeColor());
        copy.setLineSpacing(src.getLineSpacing());
        copy.setLayoutConfig(src.getLayoutConfig());
        copy.setIsPublic(false);
        copy.setShareEnabled(false);
        copy.setViewCount(0);
        copy.setStatus("draft");
        resumeMapper.insert(copy);

        List<ResumeSection> sections = sectionMapper.findByResumeIdOrdered(id);
        for (ResumeSection s : sections) {
            ResumeSection ns = new ResumeSection();
            ns.setId(UUID.randomUUID());
            ns.setResumeId(copy.getId());
            ns.setSectionType(s.getSectionType());
            ns.setSortOrder(s.getSortOrder());
            ns.setIsVisible(s.getIsVisible());
            ns.setLayout(s.getLayout());
            ns.setData(s.getData());
            sectionMapper.insert(ns);
        }
        return copy.getId();
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        Resume resume = requireOwned(id, userId);
        sectionMapper.deleteByResumeId(resume.getId());
        resumeMapper.deleteById(resume.getId());
    }

    // ---------------------------------------------------------------
    // 章节
    // ---------------------------------------------------------------

    @Transactional
    public ResumeSection addSection(UUID resumeId, UUID userId, UpdateSectionRequest req) {
        requireOwned(resumeId, userId);
        ResumeSection section = new ResumeSection();
        section.setId(UUID.randomUUID());
        section.setResumeId(resumeId);
        section.setSectionType(req.getSectionType());
        section.setSortOrder(req.getSortOrder());
        section.setIsVisible(req.getIsVisible() != null ? req.getIsVisible() : true);
        section.setLayout(req.getLayout() != null ? req.getLayout() : "single-column");
        section.setData(req.getData());
        sectionMapper.insert(section);
        return section;
    }

    @Transactional
    public void updateSection(UUID sectionId, UUID userId, UpdateSectionRequest req) {
        ResumeSection section = requireSectionOwned(sectionId, userId);
        section.setSectionType(req.getSectionType());
        section.setSortOrder(req.getSortOrder());
        if (req.getIsVisible() != null) section.setIsVisible(req.getIsVisible());
        if (req.getLayout() != null) section.setLayout(req.getLayout());
        section.setData(req.getData());
        sectionMapper.updateById(section);
    }

    @Transactional
    public void deleteSection(UUID sectionId, UUID userId) {
        ResumeSection section = requireSectionOwned(sectionId, userId);
        sectionMapper.deleteById(section.getId());
    }

    @Transactional
    public void toggleSectionVisibility(UUID sectionId, UUID userId) {
        ResumeSection section = requireSectionOwned(sectionId, userId);
        section.setIsVisible(section.getIsVisible() == null || !section.getIsVisible());
        sectionMapper.updateById(section);
    }

    @Transactional
    public void reorderSections(UUID resumeId, UUID userId, List<Map<String, Object>> orderList) {
        requireOwned(resumeId, userId);
        for (int i = 0; i < orderList.size(); i++) {
            Object rawId = orderList.get(i).get("id");
            if (rawId == null) continue;
            UUID sectionId = UUID.fromString(rawId.toString());
            ResumeSection section = sectionMapper.selectById(sectionId);
            if (section != null && section.getResumeId().equals(resumeId)) {
                section.setSortOrder(i);
                sectionMapper.updateById(section);
            }
        }
    }

    /** 新增「实习经历/项目经历」等列表型模块的快捷入口，直接写入一条空记录 */
    @Transactional
    public ResumeSection appendListItem(UUID resumeId, UUID userId, UUID sectionId, int index) {
        ResumeSection section = requireSectionOwned(sectionId, userId);
        if (!section.getResumeId().equals(resumeId)) {
            throw new IllegalArgumentException("模块不属于该简历");
        }
        sectionMapper.updateById(section);
        return section;
    }

    // ---------------------------------------------------------------
    // 元信息更新
    // ---------------------------------------------------------------

    @Transactional
    public void updateResume(UUID id, UUID userId, UpdateResumeRequest req) {
        Resume resume = requireOwned(id, userId);
        if (req.getTitle() != null && !req.getTitle().isBlank()) resume.setTitle(req.getTitle());
        if (req.getTemplateId() != null) resume.setTemplateId(req.getTemplateId());
        if (req.getTargetJob() != null) resume.setTargetJob(req.getTargetJob());
        if (req.getTargetCompany() != null) resume.setTargetCompany(req.getTargetCompany());
        if (req.getFontFamily() != null) resume.setFontFamily(req.getFontFamily());
        if (req.getFontSize() != null) resume.setFontSize(req.getFontSize());
        if (req.getThemeColor() != null) resume.setThemeColor(req.getThemeColor());
        if (req.getLineSpacing() != null) resume.setLineSpacing(req.getLineSpacing());
        if (req.getLayoutConfig() != null) resume.setLayoutConfig(req.getLayoutConfig());
        if (req.getStatus() != null) resume.setStatus(req.getStatus());
        if (req.getShareEnabled() != null) {
            resume.setShareEnabled(req.getShareEnabled());
            if (req.getShareEnabled() && (resume.getShareToken() == null || resume.getShareToken().isBlank())) {
                resume.setShareToken(randomToken(24));
            }
        }
        resumeMapper.updateById(resume);
    }

    // ---------------------------------------------------------------
    // 分享
    // ---------------------------------------------------------------

    @Transactional
    public Map<String, Object> enableShare(UUID id, UUID userId) {
        Resume resume = requireOwned(id, userId);
        if (resume.getShareToken() == null || resume.getShareToken().isBlank()) {
            resume.setShareToken(randomToken(24));
        }
        resume.setShareEnabled(true);
        resumeMapper.updateById(resume);
        return Map.of("shareToken", resume.getShareToken(), "shareEnabled", true);
    }

    @Transactional
    public void disableShare(UUID id, UUID userId) {
        Resume resume = requireOwned(id, userId);
        resume.setShareEnabled(false);
        resumeMapper.updateById(resume);
    }

    // ---------------------------------------------------------------
    // 版本快照
    // ---------------------------------------------------------------

    @Transactional
    public VersionSummaryResponse createVersion(UUID resumeId, UUID userId, CreateVersionRequest req) {
        Resume resume = requireOwned(resumeId, userId);
        ResumeDetailResponse detail = toDetail(resume);

        ResumeVersion version = new ResumeVersion();
        version.setId(UUID.randomUUID());
        version.setResumeId(resumeId);
        version.setVersionNum(versionMapper.findMaxVersionNum(resumeId) + 1);
        version.setLabel(req.getLabel());
        version.setDescription(req.getDescription());
        version.setCreatedAt(Instant.now());
        try {
            version.setSnapshot(objectMapper.writeValueAsString(detail));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("快照序列化失败", e);
        }
        versionMapper.insert(version);

        VersionSummaryResponse out = new VersionSummaryResponse();
        out.setId(version.getId());
        out.setVersionNum(version.getVersionNum());
        out.setLabel(version.getLabel());
        out.setDescription(version.getDescription());
        out.setCreatedAt(version.getCreatedAt());
        return out;
    }

    public List<VersionSummaryResponse> listVersions(UUID resumeId, UUID userId) {
        requireOwned(resumeId, userId);
        return versionMapper.findByResumeId(resumeId).stream().map(v -> {
            VersionSummaryResponse out = new VersionSummaryResponse();
            out.setId(v.getId());
            out.setVersionNum(v.getVersionNum());
            out.setLabel(v.getLabel());
            out.setDescription(v.getDescription());
            out.setCreatedAt(v.getCreatedAt());
            return out;
        }).collect(Collectors.toList());
    }

    /** 将指定历史版本回滚为当前内容（回滚前自动保留一份当前快照） */
    @Transactional
    public void restoreVersion(UUID resumeId, UUID userId, UUID versionId) {
        Resume resume = requireOwned(resumeId, userId);
        ResumeVersion version = versionMapper.selectById(versionId);
        if (version == null || !version.getResumeId().equals(resumeId)) {
            throw new IllegalArgumentException("版本不存在");
        }

        // 回滚前备份当前状态
        CreateVersionRequest backup = new CreateVersionRequest();
        backup.setLabel("回滚前自动备份");
        backup.setDescription("系统在回滚到 v" + version.getVersionNum() + " 前自动保存");
        createVersion(resumeId, userId, backup);

        try {
            JsonNode snapshot = objectMapper.readTree(version.getSnapshot());
            JsonNode sections = snapshot.get("sections");
            sectionMapper.deleteByResumeId(resumeId);

            ResumeDetailResponse restored = objectMapper.treeToValue(snapshot, ResumeDetailResponse.class);
            resume.setTitle(restored.getTitle());
            resume.setTemplateId(restored.getTemplateId());
            resume.setTargetJob(restored.getTargetJob());
            resume.setTargetCompany(restored.getTargetCompany());
            resume.setFontFamily(restored.getFontFamily());
            resume.setFontSize(restored.getFontSize());
            resume.setThemeColor(restored.getThemeColor());
            resume.setLineSpacing(restored.getLineSpacing());
            resume.setLayoutConfig(restored.getLayoutConfig());
            resumeMapper.updateById(resume);

            if (sections != null && sections.isArray()) {
                for (JsonNode node : sections) {
                    ResumeSection s = new ResumeSection();
                    s.setId(UUID.randomUUID());
                    s.setResumeId(resumeId);
                    s.setSectionType(node.path("sectionType").asText("custom"));
                    s.setSortOrder(node.path("sortOrder").asInt(0));
                    s.setIsVisible(node.path("isVisible").asBoolean(true));
                    s.setLayout(node.path("layout").asText("single-column"));
                    s.setData(objectMapper.writeValueAsString(node.path("data")));
                    sectionMapper.insert(s);
                }
            }
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("版本数据损坏，无法回滚", e);
        }
    }

    @Transactional
    public void deleteVersion(UUID resumeId, UUID userId, UUID versionId) {
        requireOwned(resumeId, userId);
        ResumeVersion version = versionMapper.selectById(versionId);
        if (version != null && version.getResumeId().equals(resumeId)) {
            versionMapper.deleteById(versionId);
        }
    }

    // ---------------------------------------------------------------
    // 统计
    // ---------------------------------------------------------------

    public ResumeStatsResponse stats(UUID userId) {
        List<Resume> resumes = listByUser(userId);
        ResumeStatsResponse stats = new ResumeStatsResponse();
        stats.setTotalResumes(resumes.size());
        stats.setCompletedResumes((int) resumes.stream().filter(r -> "complete".equals(r.getStatus())).count());
        stats.setDraftResumes((int) resumes.stream().filter(r -> !"complete".equals(r.getStatus())).count());
        stats.setSharedResumes((int) resumes.stream().filter(r -> Boolean.TRUE.equals(r.getShareEnabled())).count());
        stats.setTotalViews(resumes.stream()
                .mapToLong(r -> r.getViewCount() == null ? 0 : r.getViewCount()).sum());
        resumes.stream()
                .map(Resume::getUpdatedAt)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .ifPresent(stats::setLastEditedAt);

        if (!resumes.isEmpty()) {
            int total = resumes.stream().mapToInt(this::estimateCompleteness).sum();
            stats.setCompleteness(Math.round((float) total / resumes.size()));
        }
        return stats;
    }

    /** 依据已填写的模块数量与内容量粗估完成度，用于仪表盘进度环 */
    private int estimateCompleteness(Resume resume) {
        List<ResumeSection> sections = sectionMapper.findByResumeIdOrdered(resume.getId());
        if (sections.isEmpty()) return 0;
        int score = 0;
        // 基础信息 15 分
        score += 15;
        // 模块覆盖度最高 60 分（6 个关键模块）
        Set<String> types = sections.stream().map(ResumeSection::getSectionType).collect(Collectors.toSet());
        long keySections = types.stream().filter(t ->
                Set.of("summary", "experience", "projects", "education", "skills", "awards").contains(t)).count();
        score += keySections * 10;
        // 内容充实度最高 25 分
        int filled = (int) sections.stream().filter(s -> {
            String d = s.getData();
            return d != null && d.length() > 60;
        }).count();
        score += Math.min(25, filled * 4);
        return Math.min(100, score);
    }

    // ---------------------------------------------------------------
    // 内部工具
    // ---------------------------------------------------------------

    private Resume requireOwned(UUID id, UUID userId) {
        Resume resume = resumeMapper.selectById(id);
        if (resume == null || !resume.getUserId().equals(userId)) {
            throw new IllegalArgumentException("简历不存在或无权访问");
        }
        return resume;
    }

    private ResumeSection requireSectionOwned(UUID sectionId, UUID userId) {
        ResumeSection section = sectionMapper.selectById(sectionId);
        if (section == null) throw new IllegalArgumentException("模块不存在");
        Resume resume = resumeMapper.selectById(section.getResumeId());
        if (resume == null || !resume.getUserId().equals(userId)) {
            throw new IllegalArgumentException("无权操作该模块");
        }
        return section;
    }

    private static String randomToken(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(TOKEN_ALPHABET.charAt(RANDOM.nextInt(TOKEN_ALPHABET.length())));
        }
        return sb.toString();
    }
}
