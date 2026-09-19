/**
 * 港股 / A 股（以及常见美股、指数、加密）代码 → 公司名映射。
 * 用户记不住数字代码，界面上统一显示「代码 名称」。
 */
const NAMES: Record<string, string> = {
  // 港股
  "0700.HK": "腾讯控股",
  "9988.HK": "阿里巴巴-W",
  "3690.HK": "美团-W",
  "1810.HK": "小米集团-W",
  "1211.HK": "比亚迪股份",
  "9618.HK": "京东集团-SW",
  "9999.HK": "网易-S",
  "2318.HK": "中国平安",
  "0939.HK": "建设银行",
  "0941.HK": "中国移动",
  "1299.HK": "友邦保险",
  "2020.HK": "安踏体育",
  "0388.HK": "香港交易所",
  "1024.HK": "快手-W",
  "2269.HK": "药明生物",
  "3888.HK": "金山软件",
  "0005.HK": "汇丰控股",
  "0823.HK": "领展房产基金",
  "1398.HK": "工商银行",
  "3033.HK": "南方恒生科技ETF",
  "2800.HK": "盈富基金",
  "2828.HK": "恒生中国企业ETF",
  // A 股
  "600519.SS": "贵州茅台",
  "601318.SS": "中国平安",
  "600036.SS": "招商银行",
  "601899.SS": "紫金矿业",
  "600030.SS": "中信证券",
  "688981.SS": "中芯国际",
  "000858.SZ": "五粮液",
  "300750.SZ": "宁德时代",
  "002594.SZ": "比亚迪",
  "000333.SZ": "美的集团",
  "000001.SZ": "平安银行",
  // 指数
  "^HSI": "恒生指数",
  "^HSCE": "恒生中国企业指数",
  "^HSNF": "恒生金融业指数",
  "^HSNP": "恒生地产建筑业指数",
  "^HSNU": "恒生公用事业指数",
  "^HSNC": "恒生工商业指数",
  "^GSPC": "标普500",
  "^IXIC": "纳斯达克综合",
  "^DJI": "道琼斯工业",
  "^N225": "日经225",
  "^VIX": "VIX 恐慌指数",
  // 常见美股与加密
  NVDA: "英伟达",
  AAPL: "苹果",
  TSLA: "特斯拉",
  MSFT: "微软",
  AMZN: "亚马逊",
  GOOGL: "谷歌",
  META: "Meta",
  TSM: "台积电",
  "BTC-USD": "比特币",
  "ETH-USD": "以太坊",
};

/** 已知代码返回公司名，未知返回 null（不猜测）。 */
export function symbolName(symbol: string): string | null {
  const key = symbol.trim().toUpperCase();
  return NAMES[key] ?? NAMES[key.replace(/^0+(?=\d{4}\.HK$)/, "")] ?? null;
}

/** 展示用「代码 名称」；数字代码类市场（港股 / A 股）最需要这一层。 */
export function symbolLabel(symbol: string, fallbackName?: string): string {
  const name = symbolName(symbol) ?? fallbackName?.trim();
  return name ? `${symbol} ${name}` : symbol;
}
