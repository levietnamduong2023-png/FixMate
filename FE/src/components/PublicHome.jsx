import { idOf, money } from '../api.js';

const steps = [
  ['01', 'Mô tả vấn đề', 'Chọn dịch vụ, thời gian và cho chúng tôi biết điều gì đang xảy ra.'],
  ['02', 'Nhận báo giá', 'So sánh giá, kinh nghiệm và đánh giá từ các thợ đã xác minh.'],
  ['03', 'Sửa chữa an tâm', 'Theo dõi tiến độ, thanh toán và đánh giá ngay trên FixMate.'],
];

export default function PublicHome({ services, onStart }) {
  return (
    <main>
      <section className="hero shell">
        <div className="hero-copy">
          <span className="eyebrow">Thợ chuẩn · Giá rõ · Đến đúng hẹn</span>
          <h1>Chuyện trong nhà,<br /><em>để FixMate lo.</em></h1>
          <p>Đặt lịch sửa chữa tại nhà trong vài phút. Nhận báo giá minh bạch từ những người thợ đã được xác minh.</p>
          <div className="hero-actions">
            <button className="button primary" onClick={onStart}>Đặt dịch vụ ngay <span>→</span></button>
            <a className="button ghost" href="#services">Khám phá dịch vụ</a>
          </div>
          <div className="trust-row">
            <span><b>4.9/5</b> điểm hài lòng</span>
            <span><b>100%</b> giá được duyệt trước</span>
            <span><b>7 ngày</b> hỗ trợ mỗi tuần</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="Minh họa quy trình FixMate">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="tool-mark">FM</div>
          <div className="floating-card card-top"><span className="status-dot" /> Thợ đang trên đường</div>
          <div className="floating-card card-bottom"><b>✓</b><span><strong>Đã xác minh</strong><small>Hồ sơ & chuyên môn</small></span></div>
        </div>
      </section>

      <section id="services" className="section shell">
        <div className="section-heading">
          <div><span className="eyebrow">Dịch vụ phổ biến</span><h2>Mọi thứ ngôi nhà cần</h2></div>
          <p>Từ việc nhỏ bất chợt đến bảo trì định kỳ, chọn đúng chuyên môn và nhận hỗ trợ nhanh chóng.</p>
        </div>
        <div className="service-grid">
          {services.map((service, index) => (
            <article className="service-card" key={idOf(service)}>
              <span className="service-index">0{index + 1}</span>
              <div className="service-icon">{['⚡', '◒', '❄', '◉', '▣', '⌂'][index % 6]}</div>
              <h3>{service.name}</h3>
              <p>{service.description}</p>
              <footer><span>Từ {money(service.basePrice)}</span><button onClick={onStart} aria-label={`Đặt ${service.name}`}>↗</button></footer>
            </article>
          ))}
        </div>
      </section>

      <section className="how-section" id="how">
        <div className="shell">
          <span className="eyebrow light">Đơn giản từ đầu đến cuối</span>
          <h2>Ba bước. Một trải nghiệm an tâm.</h2>
          <div className="steps-grid">
            {steps.map(([number, title, description]) => (
              <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
