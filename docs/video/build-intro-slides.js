// Builds docs/video/intro-slides.pptx (needs pptxgenjs: npm i pptxgenjs, run from any folder where it is installed).
const pptxgen = require("pptxgenjs");
const IMG = "/home/user/ant-takehome/docs/writeup/img/";
const OUT = "/home/user/ant-takehome/docs/video/intro-slides.pptx";

const BG = "F6F3EB";      // warm paper, matches the illustrations
const INK = "1F1E1D";
const MUTED = "6B675E";
const CLAY = "C96442";    // Claude-style accent
const SERIF = "Cambria";
const SANS = "Calibri";

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
pres.title = "Learn mode — intro";

// Small eight-point spark, drawn from rotated rounded bars.
function spark(slide, cx, cy, size) {
  const w = size * 0.13, h = size * 0.5;
  for (let i = 0; i < 4; i++) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: cx - w / 2, y: cy - h, w, h: h * 2, rectRadius: w / 2,
      fill: { color: CLAY }, line: { color: CLAY, width: 0 }, rotate: i * 45,
    });
  }
}

// 1 — Name and submission header
{
  const s = pres.addSlide();
  s.background = { color: BG };
  spark(s, 0.95, 1.55, 0.62);
  s.addText("Anthropic Education Labs  ·  Take-home submission", {
    x: 0.7, y: 2.15, w: 8.6, h: 0.35, fontFace: SANS, fontSize: 13, color: CLAY, bold: true, charSpacing: 1, margin: 0, isTextBox: true,
  });
  s.addText("Learn mode", {
    x: 0.7, y: 2.5, w: 8.6, h: 0.95, fontFace: SERIF, fontSize: 50, color: INK, margin: 0, isTextBox: true,
  });
  s.addText("Claude does the work. You learn from it while it happens.", {
    x: 0.7, y: 3.45, w: 8.6, h: 0.45, fontFace: SERIF, fontSize: 20, italic: true, color: MUTED, margin: 0, isTextBox: true,
  });
  s.addText("Arvind  ·  Option B: Learning through collaboration with Claude", {
    x: 0.7, y: 4.55, w: 8.6, h: 0.35, fontFace: SANS, fontSize: 13, color: MUTED, margin: 0, isTextBox: true,
  });
  s.addNotes("Hi, I'm Arvind. This is Learn mode, my take on Option B. In one line: Claude does the work, and you learn from it while it happens.");
}

// 2 — Brief excerpt with the forklift and the microwave
{
  const s = pres.addSlide();
  s.background = { color: BG };
  s.addText("The problem", {
    x: 0.6, y: 0.95, w: 4.2, h: 0.35, fontFace: SANS, fontSize: 13, color: CLAY, bold: true, charSpacing: 1, margin: 0, isTextBox: true,
  });
  s.addText("“When AI agents handle complex tasks autonomously, humans can become passive observers rather than active learners, missing opportunities to develop their own skills and understanding.”", {
    x: 0.6, y: 1.4, w: 4.3, h: 2.45, fontFace: SERIF, fontSize: 21, color: INK, valign: "top", margin: 0, paraSpaceAfter: 0, lineSpacingMultiple: 1.1, isTextBox: true,
  });
  s.addText("Education Labs brief · Challenge 2: Cognitive engagement", {
    x: 0.6, y: 3.95, w: 4.3, h: 0.3, fontFace: SANS, fontSize: 11, color: MUTED, margin: 0, isTextBox: true,
  });
  // Two illustrations stacked on the right (3:2 each).
  const iw = 3.6, ih = iw * 1024 / 1536, ix = 5.55;
  s.addImage({ path: IMG + "forklift-gym.png", x: ix, y: 0.45, w: iw, h: ih, altText: "A forklift lifting a barbell in a gym" });
  s.addImage({ path: IMG + "microwave-rust.png", x: ix, y: 0.45 + ih + 0.18, w: iw, h: ih, altText: "A microwave meal next to rusting pots and dull knives" });
  s.addNotes("The brief puts it well: when agents do complex work on their own, people become passive observers. Agents are a forklift in the gym and a microwave in the kitchen. The work gets done, but the muscle doesn't grow and the knives go dull.");
}

// 3 — The meme
{
  const s = pres.addSlide();
  s.background = { color: BG };
  s.addText("People go to the counter that finishes the task", {
    x: 0.6, y: 0.35, w: 8.8, h: 0.55, fontFace: SERIF, fontSize: 26, color: INK, align: "center", margin: 0, isTextBox: true,
  });
  const mh = 4.2, mw = mh * 1536 / 986;
  s.addImage({ path: IMG + "two-counters.jpg", x: (10 - mw) / 2, y: 1.1, w: mw, h: mh, altText: "Two counters: a short line at 'teaches you how to do a task yourself', a huge crowd at 'finishes the task autonomously'" });
  s.addNotes("When something needs doing, people go to the counter that finishes the task. Many good learning products get little use; I've built some. So I put the learning inside Claude, where people already are, and it never makes the task wait.");
}

pres.writeFile({ fileName: OUT }).then((f) => console.log("wrote", f));
