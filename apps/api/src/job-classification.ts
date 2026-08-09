export const jobCategoryIds = [
  "ai",
  "fullstack",
  "frontend",
  "backend",
  "mobile",
  "product",
  "design",
  "data",
  "operations",
  "marketing",
  "other",
] as const;

export type JobCategory = typeof jobCategoryIds[number];

const categoryPatterns: { id: JobCategory; pattern: RegExp }[] = [
  { id: "fullstack", pattern: /(全栈(?:开发|工程师|研发)?|full[ -]?stack\s+(?:(?:software|web)\s+)?(?:engineer|developer)|fullstack\s+(?:engineer|developer))/i },
  { id: "frontend", pattern: /(前端(?:开发|工程师|研发|实习生|岗位)|(?:frontend|front-end|front end)\s+(?:engineer|developer|intern|role))/i },
  { id: "mobile", pattern: /((?:iOS|Android|Flutter|React Native|移动端|客户端)(?:\s|-)*(?:开发|工程师|研发|developer|engineer)|mobile\s+(?:engineer|developer))/i },
  { id: "ai", pattern: /((?:AI|人工智能|机器学习|大模型|LLM|AIGC|算法)(?:\s|[-/·]){0,8}(?:工程师|开发|研发|算法|研究员|科学家|架构师|产品经理|实习生|engineer|developer|researcher|scientist|architect|product manager)|(?:工程师|开发|研发|算法|研究员|科学家|架构师|产品经理|engineer|developer|researcher|scientist|architect)\s*(?:AI|人工智能|机器学习|大模型|LLM|AIGC))/i },
  { id: "data", pattern: /(数据(?:分析(?:师|实习生?|岗位|工作)?|工程师|科学家|开发|研发|岗位)|商业分析师|BI\s*(?:工程师|分析师)|data\s+(?:analyst|engineer|scientist|developer|intern)|analytics\s+engineer)/i },
  { id: "design", pattern: /((?:UI|UX|UI\/UX|交互|视觉|产品)(?:\s|-)*(?:设计师|设计岗位|设计实习生?)|(?:UI|UX|UI\/UX|product)\s+(?:designer|design intern))/i },
  { id: "operations", pattern: /(产品运营|用户运营|内容运营|社区运营|平台运营|电商运营|新媒体运营|增长运营|商业化运营|developer relations|developer advocate|devrel|customer success|community manager|content operations|growth operations)/i },
  { id: "other", pattern: /(DevOps|SRE|site reliability|云计算(?:工程师|开发)|运维(?:工程师|开发)|测试(?:开发|工程师)|QA\s+(?:engineer|automation)|安全(?:工程师|开发|研究员)|security\s+(?:engineer|researcher)|区块链(?:工程师|开发)|blockchain\s+(?:engineer|developer)|游戏(?:开发|工程师)|game\s+(?:engineer|developer))/i },
  { id: "backend", pattern: /(后端(?:开发|工程师|研发|实习生|岗位)|服务端(?:开发|工程师|研发)|软件(?:开发|工程师|研发)|(?:backend|back-end|back end)\s+(?:engineer|developer|intern|role)|software\s+(?:engineer|developer))/i },
];

const chineseDigitalContext = /(互联网|软件|科技|技术平台|软件平台|数据平台|内容平台|电商平台|网站|云计算|电商|跨境|数字化|数字营销|增长|投放|社媒|新媒体|内容营销|搜索营销|人工智能|大模型|数据产品|游戏|区块链|淘宝|天猫|京东|抖音|小红书|微信)/i;
const englishDigitalContext = /(?:\b(?:AI|SaaS|app|web|mobile|digital|software|technology|tech|startup|e-?commerce|DTC|creator|media|social media|content platform|gaming|crypto|Web3|TikTok|Amazon|UGC|CRO)\b|paid acquisition|media buying|Meta ads|funnel optimization|tracking (?:and|&) attribution)/i;
const productRole = /(产品经理|产品负责人|产品岗|product manager|product lead|product owner)/i;
const marketingRole = /(营销|市场(?:经理|专员|岗位|负责人)|品牌(?:经理|营销|推广)|marketing|growth|SEO|SEM|投放)/i;
const digitalCreativeRole = /(视频剪辑|剪辑师|内容编辑|内容创作者|主播|video editor|motion designer|content creator|UGC creator)/i;
const nonOpportunityContent = /(招聘分享会|求职网站|面试(?:经验|复盘|准备|学习|总结|完了|被挂)|方向错了|行业分析|行业现状|就业分析|招聘趋势|人才发展报告|招聘企业数|职位数同比|市场在招什么人|hiring trends|job market report|取消.{0,8}(?:岗位|职位)|(?:岗位|职位).{0,8}消失)/i;
const nonTechnicalAiRole = /(督学|伴学|教师|老师|教培|课程顾问|销售|招生)/i;

export function classifyInternetJob(text: string, hint?: string | null): JobCategory | null {
  if (nonOpportunityContent.test(text)) return null;
  for (const category of categoryPatterns) {
    if (category.pattern.test(text)) return category.id;
  }
  if (productRole.test(text)) return "product";
  const hasDigitalContext = chineseDigitalContext.test(text) || englishDigitalContext.test(text);
  if (digitalCreativeRole.test(text) && hasDigitalContext) return "design";
  if (marketingRole.test(text) && hasDigitalContext) return "marketing";
  if (hint === "ai" && hasDigitalContext && !nonTechnicalAiRole.test(text)) return "ai";
  return null;
}
