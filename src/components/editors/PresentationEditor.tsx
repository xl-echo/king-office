import { useState, useEffect } from "react";

interface Slide {
  id: number;
  title: string;
  content: string;
  background: string;
}

interface PresentationEditorProps {
  content?: any;
  onChange: (content: any) => void;
}

export default function PresentationEditor({ content, onChange }: PresentationEditorProps) {
  const [slides, setSlides] = useState<Slide[]>([
    { id: 1, title: "欢迎使用", content: "金山办公套件演示文稿", background: "#1E3A5F" },
    { id: 2, title: "主要功能", content: "文档编辑 · 表格处理 · 演示制作", background: "#2a5080" },
    { id: 3, title: "感谢观看", content: "如有疑问，请联系支持团队", background: "#E6B800" },
  ]);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (content) {
      // 外部数据加载逻辑
    }
  }, []);

  const addSlide = () => {
    const newId = slides.length > 0 ? Math.max(...slides.map(s => s.id)) + 1 : 1;
    const newSlide: Slide = {
      id: newId,
      title: `新幻灯片 ${newId}`,
      content: "在此输入内容...",
      background: "#1E3A5F",
    };
    setSlides([...slides, newSlide]);
    setActiveSlide(slides.length);
  };

  const deleteSlide = (index: number) => {
    if (slides.length <= 1) return;
    const newSlides = slides.filter((_, i) => i !== index);
    setSlides(newSlides);
    if (activeSlide >= newSlides.length) {
      setActiveSlide(newSlides.length - 1);
    }
  };

  const updateSlide = (index: number, field: keyof Slide, value: any) => {
    const newSlides = [...slides];
    newSlides[index] = { ...newSlides[index], [field]: value };
    setSlides(newSlides);
    onChange(newSlides);
  };

  const currentSlide = slides[activeSlide];

  return (
    <div className="presentation-editor">
      <div className="slides-sidebar">
        <div className="slides-header">
          <h3>幻灯片</h3>
          <button className="add-slide-btn" onClick={addSlide}>+</button>
        </div>
        <div className="slides-list">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className={`slide-thumbnail ${activeSlide === index ? "active" : ""}`}
              onClick={() => setActiveSlide(index)}
            >
              <div className="thumbnail-number">{index + 1}</div>
              <div
                className="thumbnail-preview"
                style={{ background: slide.background }}
              >
                <div className="thumbnail-title">{slide.title.substring(0, 10)}</div>
              </div>
              {slides.length > 1 && (
                <button
                  className="delete-slide-btn"
                  onClick={(e) => { e.stopPropagation(); deleteSlide(index); }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="presentation-main">
        {currentSlide && (
          <div className="slide-editor">
            <div
              className="slide-preview"
              style={{ background: currentSlide.background }}
            >
              <div className="slide-content-display">
                <h1 className="slide-title-display">{currentSlide.title}</h1>
                <p className="slide-text-display">{currentSlide.content}</p>
              </div>
            </div>

            <div className="slide-edit-form">
              <div className="form-row">
                <label>标题</label>
                <input
                  type="text"
                  value={currentSlide.title}
                  onChange={(e) => updateSlide(activeSlide, "title", e.target.value)}
                  placeholder="输入幻灯片标题"
                />
              </div>
              <div className="form-row">
                <label>内容</label>
                <textarea
                  value={currentSlide.content}
                  onChange={(e) => updateSlide(activeSlide, "content", e.target.value)}
                  placeholder="输入幻灯片内容"
                  rows={3}
                />
              </div>
              <div className="form-row">
                <label>背景色</label>
                <input
                  type="color"
                  value={currentSlide.background}
                  onChange={(e) => updateSlide(activeSlide, "background", e.target.value)}
                />
                <div className="color-presets">
                  {["#1E3A5F", "#2a5080", "#E6B800", "#52c41a", "#f5222d", "#722ed1"].map(color => (
                    <button
                      key={color}
                      className="color-preset"
                      style={{ background: color }}
                      onClick={() => updateSlide(activeSlide, "background", color)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
