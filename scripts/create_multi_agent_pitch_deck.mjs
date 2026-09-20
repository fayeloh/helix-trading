import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.env.HELIX_PRESENTATION_DIR
  ? path.resolve(process.env.HELIX_PRESENTATION_DIR)
  : path.resolve(root, '..', 'helix trading-presentation');
const workDir = path.join(outDir, 'helix_multi_agent_pitch_deck_pkg');
const outFile = path.join(outDir, 'helix_multi_agent_pitch_deck.pptx');
await fs.rm(workDir, { recursive: true, force: true });
await fs.mkdir(workDir, { recursive: true });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const xml = (s) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${s}`;
const EMU = (px) => Math.round(px * 9525);
const C = {
  bg: '0B1220', panel: '111D2E', panel2: '15263A', line: '29435B', text: 'F5FAFF', muted: '9FB3C8', teal: '39D6C5', green: '74E39B', orange: 'F6B65B', red: 'FF7C8A', blue: '79A9FF', white: 'FFFFFF'
};
const slideW = 1280, slideH = 720;

function tx(x, y, w, h, text, size = 20, color = C.text, opts = {}) {
  const align = opts.align || 'l';
  const bold = opts.bold ? '<a:b/>' : '';
  const italic = opts.italic ? '<a:i/>' : '';
  const font = opts.font || 'Microsoft YaHei';
  const paragraphs = String(text).split('\n').map((line) => `<a:p><a:pPr algn="${align}" marL="0" indent="0" lvl="0"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft></a:pPr><a:r><a:rPr lang="zh-CN" sz="${size * 100}" dirty="0">${bold}${italic}<a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${font}"/><a:ea typeface="${font}"/></a:rPr><a:t>${esc(line)}</a:t></a:r><a:endParaRPr lang="zh-CN" sz="${size * 100}"/></a:p>`).join('');
  return `<p:sp><p:nvSpPr><p:cNvPr id="${opts.id || Math.floor(Math.random()*100000)}" name="Text"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${EMU(x)}" y="${EMU(y)}"/><a:ext cx="${EMU(w)}" cy="${EMU(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="0" lIns="12000" rIns="12000" tIns="6000" bIns="6000" anchor="ctr"><a:spAutoFit/></a:bodyPr><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`;
}
function rect(x, y, w, h, fill, opts = {}) {
  const geom = opts.geom || 'roundRect';
  const line = opts.line ? `<a:ln w="${(opts.lineWidth || 1) * 12700}"><a:solidFill><a:srgbClr val="${opts.line}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${opts.id || Math.floor(Math.random()*100000)}" name="Shape"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${EMU(x)}" y="${EMU(y)}"/><a:ext cx="${EMU(w)}" cy="${EMU(h)}"/></a:xfrm><a:prstGeom prst="${geom}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>${line}</p:spPr></p:sp>`;
}
function line(x1, y1, x2, y2, color = C.teal, width = 2, dash = false) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${Math.floor(Math.random()*100000)}" name="Line"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${EMU(x1)}" y="${EMU(y1)}"/><a:ext cx="${EMU(x2-x1)}" cy="${EMU(y2-y1)}"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="${width*12700}">${dash ? '<a:prstDash val="dash"/>' : ''}<a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:tailEnd type="triangle"/></a:ln></p:spPr></p:sp>`;
}
function slideXml(body) {
  return xml(`<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgRef idx="1001"><a:solidFill><a:srgbClr val="${C.bg}"/></a:solidFill><a:effectLst/></p:bgRef></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${body}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
}
function slideRel() { return xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`); }

function header(kicker, title, sub) {
  return tx(68, 38, 1140, 24, kicker.toUpperCase(), 13, C.teal, { bold: true }) + tx(68, 68, 1140, 56, title, 32, C.text, { bold: true }) + (sub ? tx(68, 126, 1140, 28, sub, 16, C.muted) : '') + line(68, 167, 1212, 167, C.line, 1);
}

function slide1() {
  let b = header('01 / Multi-Agent', 'Fundamentals 已形成可回退、可验证的 Multi-Agent 路径', '先冻结事实，再并行生成 Bull / Bear；Synthesizer 经过事实校验重试，失败时回到单模型路径。');
  const y = 245, h = 104;
  const boxes = [
    [68, '事实数据', '获取并冻结\n行情与基本面事实', C.blue],
    [240, 'Bull Agent', '独立构建\n看多论点', C.green],
    [412, 'Bear Agent', '独立构建\n看空论点', C.red],
    [650, 'Deep Synthesizer', '综合双方观点\n形成结构化结论', C.orange],
    [870, 'verifyAgainstFacts', '事实验证\n拦截不一致表述', C.teal],
    [1080, 'debate trace', '输出状态、耗时\n失败原因与验证结果', C.white],
  ];
  for (const [x, title, body, color] of boxes) {
    b += rect(x, y, 142, h, C.panel, { line: color, lineWidth: 1.5 });
    b += tx(x+12, y+14, 118, 25, title, title.length > 15 ? 13 : 16, color, { bold: true, align: 'c' });
    b += tx(x+12, y+49, 118, 43, body, 14, C.text, { align: 'c' });
  }
  b += line(210, 297, 240, 297, C.teal, 2); b += line(382, 297, 412, 297, C.teal, 2);
  b += line(554, 297, 650, 297, C.teal, 2); b += line(792, 297, 870, 297, C.teal, 2); b += line(1012, 297, 1080, 297, C.teal, 2);
  b += tx(220, 210, 330, 24, 'Promise.all 并行执行', 14, C.teal, { bold: true, align: 'c' });
  b += line(311, 238, 311, 245, C.teal, 1.5); b += line(483, 238, 483, 245, C.teal, 1.5); b += line(311, 238, 483, 238, C.teal, 1.5);
  b += rect(68, 416, 1144, 154, C.panel2, { line: C.line, lineWidth: 1 });
  b += tx(92, 438, 220, 26, '编排特征', 16, C.teal, { bold: true });
  b += tx(92, 478, 1040, 60, 'Fast model 负责两侧分析，Deep model 负责综合；每个阶段都有超时与失败处理。\n事实校验失败先把违规项反馈给 Synthesizer 重试，仍失败则回退到单模型调用，并保留 _debate 记录。', 18, C.text);
  b += tx(1100, 438, 80, 26, '已落地', 14, C.green, { bold: true, align: 'r' });
  return slideXml(b);
}

function slide2() {
  let b = header('02 / Harness', 'Harness 把 Agent 运行变成可观测、可测试的执行单元', 'research-harness.server.ts 提供生命周期、调度、回退、验证和最小质量门禁。');
  const items = [
    ['Agent 生命周期', 'created → running → completed / failed / timed out', C.blue],
    ['超时控制', '每个阶段都能结束，避免单个 Agent 拖住整条链路', C.orange],
    ['并行调度', 'Bull / Bear 同时运行，缩短研究等待时间', C.green],
    ['Synthesizer 阶段', '把分歧显式交给深度模型综合，而不是简单拼接', C.teal],
    ['Fallback 路径', '综合失败时回到原单模型调用，保证可用性', C.red],
    ['验证器与 trace', '事实重试、verifyAgainstFacts 与 _debate 记录', C.white],
  ];
  let y = 216;
  for (let i = 0; i < items.length; i++) {
    const [title, body, color] = items[i];
    const x = i % 2 === 0 ? 68 : 650;
    if (i % 2 === 0) y = 216 + Math.floor(i/2)*108;
    b += rect(x, y, 524, 82, C.panel, { line: C.line, lineWidth: 1 });
    b += rect(x, y, 8, 82, color, { geom: 'rect' });
    b += tx(x+24, y+13, 460, 24, title, 17, color, { bold: true });
    b += tx(x+24, y+42, 462, 28, body, 14, C.text);
  }
  b += rect(68, 565, 1144, 72, '0E2330', { line: C.teal, lineWidth: 1.5 });
  b += tx(92, 578, 320, 30, '最小工程闭环', 18, C.teal, { bold: true });
  b += tx(360, 578, 820, 30, 'npm run verify ＝ lint → typecheck → 90 tests 通过（9 文件，2 个在线用例默认跳过）', 17, C.text, { bold: true });
  b += tx(92, 648, 1080, 24, '评测边界：AAPL / CRWV 同快照对照；数字与日期接地率、空值陷阱、Bull / Bear trace 均可复核。当前样本不证明多 Agent 优于单模型。', 13, C.muted);
  return slideXml(b);
}

function slide3() {
  let b = header('03 / Application workflow', 'Multi-Agent 已嵌入真实的研究工作流', 'fundamentals 使用 Multi-Agent，其他研究模块保留单模型路径；下方同时标出当前证据与后续展望。');
  const nodes = [
    [68, '输入股票代码', '用户输入\nTSLA / AAPL / ...', C.blue],
    [262, '解析与验证', '标准化 symbol\n检查可研究性', C.teal],
    [456, '获取事实数据', '行情、基本面\n新闻与宏观数据', C.orange],
    [650, '选择研究模块', 'fundamentals\n或其他模块', C.white],
    [844, '执行研究流程', 'fundamentals：\nMulti-Agent', C.green],
    [1038, '结构化输出', 'JSON → 前端展示\n并写入缓存', C.red],
  ];
  const y = 242;
  for (const [x, title, body, color] of nodes) {
    b += rect(x, y, 160, 120, C.panel, { line: color, lineWidth: 1.5 });
    b += tx(x+12, y+16, 136, 30, title, title.length > 7 ? 14 : 16, color, { bold: true, align: 'c' });
    b += tx(x+12, y+57, 136, 45, body, 14, C.text, { align: 'c' });
  }
  for (let i=0;i<nodes.length-1;i++) b += line(nodes[i][0]+160, y+60, nodes[i+1][0], y+60, C.teal, 2);
  b += tx(68, 202, 1140, 24, '一条入口，多条研究策略', 17, C.teal, { bold: true });
  b += rect(68, 430, 548, 164, C.panel2, { line: C.teal, lineWidth: 1 });
  b += tx(92, 452, 240, 24, '当前证据', 16, C.teal, { bold: true });
  b += tx(92, 490, 490, 82, 'golden fixture：AAPL / CRWV / ZZZZZZ\n10/10、8/8 与 1/1、2/2 事实声明有据\n空值陷阱未被编造，结果可从原始输出重算', 16, C.text);
  b += rect(664, 430, 548, 164, C.panel2, { line: C.orange, lineWidth: 1 });
  b += tx(688, 452, 240, 24, '后续展望', 16, C.orange, { bold: true });
  b += tx(688, 490, 490, 82, '扩充 Golden Dataset 与 CI 回归门禁\n补 semantic Judge，再评估 earnings 多 Agent\n宏观四阶段流水线列为 Phase 3，不纳入当前 MVP', 16, C.text);
  return slideXml(b);
}

const slides = [slide1(), slide2(), slide3()];

const files = {
  '[Content_Types].xml': xml(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slides.map((_, i)=>`<Override PartName="/ppt/slides/slide${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`),
  '_rels/.rels': xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`),
  'ppt/presentation.xml': xml(`<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId4"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_,i)=>`<p:sldId id="${255+i}" r:id="rId${i+1}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr/><a:lvl1pPr marL="0" algn="l"><a:defRPr lang="zh-CN" sz="1800"/></a:lvl1pPr></p:defaultTextStyle></p:presentation>`),
  'ppt/_rels/presentation.xml.rels': xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slides.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i+1}.xml"/>`).join('')}<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/></Relationships>`),
  'ppt/slideMasters/slideMaster1.xml': xml(`<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="Master"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`),
  'ppt/slideMasters/_rels/slideMaster1.xml.rels': xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`),
  'ppt/slideLayouts/slideLayout1.xml': xml(`<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`),
  'ppt/slideLayouts/_rels/slideLayout1.xml.rels': xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`),
  'ppt/theme/theme1.xml': xml(`<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Helix"><a:themeElements><a:clrScheme name="Helix"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="0B1220"/></a:dk2><a:lt2><a:srgbClr val="F5FAFF"/></a:lt2><a:accent1><a:srgbClr val="39D6C5"/></a:accent1><a:accent2><a:srgbClr val="79A9FF"/></a:accent2><a:accent3><a:srgbClr val="F6B65B"/></a:accent3><a:accent4><a:srgbClr val="FF7C8A"/></a:accent4><a:accent5><a:srgbClr val="74E39B"/></a:accent5><a:accent6><a:srgbClr val="9FB3C8"/></a:accent6><a:hlink><a:srgbClr val="39D6C5"/></a:hlink><a:folHlink><a:srgbClr val="79A9FF"/></a:folHlink></a:clrScheme><a:fontScheme name="Helix"><a:majorFont><a:latin typeface="Microsoft YaHei"/></a:majorFont><a:minorFont><a:latin typeface="Microsoft YaHei"/></a:minorFont></a:fontScheme><a:fmtScheme name="Helix"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>`),
  'docProps/core.xml': xml(`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"><dc:title>Helix Trading Multi-Agent Research</dc:title><dc:creator>Helix Trading</dc:creator><dc:description>路演材料：Multi-Agent、Harness、离线评测与应用层工作流</dc:description></cp:coreProperties>`),
  'docProps/app.xml': xml(`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft PowerPoint</Application><PresentationFormat>Widescreen</PresentationFormat><Slides>3</Slides></Properties>`),
};
for (let i=0;i<slides.length;i++) { files[`ppt/slides/slide${i+1}.xml`] = slides[i]; files[`ppt/slides/_rels/slide${i+1}.xml.rels`] = slideRel(); }
for (const [name, content] of Object.entries(files)) { const full = path.join(workDir, name); await fs.mkdir(path.dirname(full), { recursive: true }); await fs.writeFile(full, content); }
await fs.rm(outFile, { force: true });
await execFileAsync('zip', ['-q', '-r', outFile, '.'], { cwd: workDir });
console.log(outFile);
