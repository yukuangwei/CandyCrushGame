// ========== 游戏配置 ==========
const CONFIG = {
    GRID_COLS: 6,
    GRID_ROWS: 8,
    MAX_ELEMENT: 10,
    PRODUCTION_INTERVAL: 5000, // 5秒
    PRODUCTION_MAX: 5,
    H_PROBABILITY: 0.7, // 氢的生成概率
    SPEED_BOOST_DURATION: 1000, // 加速后1秒立即生产
};

// ========== 元素数据 ==========
const ELEMENTS = {
    1:  { symbol: 'H',  name: '氢',  nameEn: 'Hydrogen',  number: 1,  year: '1766', desc: '宇宙中最丰富的元素，太阳的主要燃料。无色无味的气体，是最轻的元素。', use: '火箭燃料、氢能源、化工原料' },
    2:  { symbol: 'He', name: '氦',  nameEn: 'Helium',    number: 2,  year: '1868', desc: '惰性气体，不参与化学反应。在太阳光谱中首次被发现，因此以太阳神命名。', use: '气球填充、深潜呼吸气、超导冷却' },
    3:  { symbol: 'Li', name: '锂',  nameEn: 'Lithium',   number: 3,  year: '1817', desc: '最轻的金属元素，密度仅为水的一半。在电池技术中扮演核心角色。', use: '锂电池、精神科药物、合金材料' },
    4:  { symbol: 'Be', name: '铍',  nameEn: 'Beryllium', number: 4,  year: '1798', desc: '轻质高强度金属，X射线几乎可完全穿透。但其粉尘对人体有毒。', use: 'X射线窗口、航天合金、核反应堆' },
    5:  { symbol: 'B',  name: '硼',  nameEn: 'Boron',     number: 5,  year: '1808', desc: '类金属元素，硬度仅次于金刚石。在自然界中不以单质形式存在。', use: '硼玻璃、清洁剂、半导体掺杂' },
    6:  { symbol: 'C',  name: '碳',  nameEn: 'Carbon',    number: 6,  year: '古代', desc: '生命的基础元素，有金刚石和石墨等多种同素异形体。有机化学的核心。', use: '钻石、燃料、碳纤维、有机化合物' },
    7:  { symbol: 'N',  name: '氮',  nameEn: 'Nitrogen',  number: 7,  year: '1772', desc: '大气中含量最多的气体（78%），是蛋白质和DNA的重要组成元素。', use: '化肥、炸药、食品保鲜、液氮冷冻' },
    8:  { symbol: 'O',  name: '氧',  nameEn: 'Oxygen',    number: 8,  year: '1774', desc: '生命必需的元素，地壳中含量最多的元素。支持燃烧和呼吸。', use: '呼吸、炼钢、医疗供氧、火箭氧化剂' },
    9:  { symbol: 'F',  name: '氟',  nameEn: 'Fluorine',  number: 9,  year: '1886', desc: '最活泼的非金属元素，几乎能与所有元素反应。牙膏中添加氟化物防龋齿。', use: '含氟牙膏、特氟龙涂层、制冷剂' },
    10: { symbol: 'Ne', name: '氖',  nameEn: 'Neon',      number: 10, year: '1898', desc: '惰性气体，通电时发出醒目的橙红色光。霓虹灯因它而得名。', use: '霓虹灯、激光器、高压指示灯' },
};

// ========== 任务数据 ==========
const DAILY_TASKS_POOL = [
    { id: 'd1', title: '合成3个氦元素',   desc: '将氢元素两两合成', target: 3,  element: 2, type: 'merge',   reward: { type: 'shovel', amount: 1 }, rewardText: '铲子 x1' },
    { id: 'd2', title: '合成2个锂元素',   desc: '将氦元素两两合成', target: 2,  element: 3, type: 'merge',   reward: { type: 'swap', amount: 1 },   rewardText: '交换器 x1' },
    { id: 'd3', title: '收集5种不同元素', desc: '解锁不同种类的元素', target: 5,  element: 0, type: 'collect', reward: { type: 'copy', amount: 1 },   rewardText: '复制器 x1' },
    { id: 'd4', title: '合成5个氦元素',   desc: '大量生产氦气',     target: 5,  element: 2, type: 'merge',   reward: { type: 'shovel', amount: 2 }, rewardText: '铲子 x2' },
    { id: 'd5', title: '合成1个碳元素',   desc: '碳是生命的基础',   target: 1,  element: 6, type: 'merge',   reward: { type: 'copy', amount: 1 },   rewardText: '复制器 x1' },
    { id: 'd6', title: '生产10个元素方块', desc: '从生产单元获取方块', target: 10, element: 0, type: 'produce', reward: { type: 'swap', amount: 1 },   rewardText: '交换器 x1' },
];

const ACHIEVEMENTS = [
    { id: 'a1',  title: '初入实验室',     desc: '完成第一次合成',         target: 1,  type: 'total_merge', reward: { type: 'shovel', amount: 1 }, rewardText: '铲子 x1' },
    { id: 'a2',  title: '元素新手',       desc: '收集3种不同元素',        target: 3,  type: 'collect',     reward: { type: 'swap', amount: 1 },   rewardText: '交换器 x1' },
    { id: 'a3',  title: '首次合成碳',     desc: '合成出碳元素(C)',        target: 1,  element: 6, type: 'first_merge', reward: { type: 'copy', amount: 1 },   rewardText: '复制器 x1' },
    { id: 'a4',  title: '元素收藏家',     desc: '收集5种不同元素',        target: 5,  type: 'collect',     reward: { type: 'shovel', amount: 2 }, rewardText: '铲子 x2' },
    { id: 'a5',  title: '合成大师',       desc: '累计完成50次合成',       target: 50, type: 'total_merge', reward: { type: 'swap', amount: 2 },   rewardText: '交换器 x2' },
    { id: 'a6',  title: '首次合成氧',     desc: '合成出氧元素(O)',        target: 1,  element: 8, type: 'first_merge', reward: { type: 'copy', amount: 1 },   rewardText: '复制器 x1' },
    { id: 'a7',  title: '首次合成氖',     desc: '合成出氖元素(Ne)',       target: 1,  element: 10, type: 'first_merge', reward: { type: 'shovel', amount: 3 }, rewardText: '铲子 x3' },
    { id: 'a8',  title: '集齐前10种元素', desc: '解锁全部10种元素',       target: 10, type: 'collect',     reward: { type: 'copy', amount: 3 },   rewardText: '复制器 x3' },
    { id: 'a9',  title: '合成专家',       desc: '累计完成100次合成',      target: 100,type: 'total_merge', reward: { type: 'swap', amount: 3 },   rewardText: '交换器 x3' },
    { id: 'a10', title: '元素之王',       desc: '累计完成200次合成',      target: 200,type: 'total_merge', reward: { type: 'copy', amount: 2 },   rewardText: '复制器 x2' },
];

// ========== 商城数据 ==========
const SHOP_ITEMS = [
    { id: 's1', name: '铲子',   icon: "\u26CF",  desc: '移除一个不需要的方块',           tool: 'shovel', amount: 1, cost: '观看广告' },
    { id: 's2', name: '交换器', icon: "\u21C4",  desc: '交换两个方块的位置',             tool: 'swap',   amount: 1, cost: '观看广告' },
    { id: 's3', name: '复制器', icon: "\u274F",  desc: '复制一个现有方块（不可复制最高级）', tool: 'copy',   amount: 1, cost: '观看广告' },
    { id: 's4', name: '铲子礼包', icon: "\u{1F381}", desc: '获得3个铲子',                 tool: 'shovel', amount: 3, cost: '特惠礼包' },
];
