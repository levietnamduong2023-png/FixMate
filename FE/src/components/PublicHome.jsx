import { useEffect, useState } from 'react';
import { api, idOf, money } from '../api.js';

const steps = [
  ['01', 'Mô tả vấn đề', 'Chọn dịch vụ, thời gian và cho chúng tôi biết điều gì đang xảy ra.'],
  ['02', 'Nhận báo giá', 'So sánh giá, kinh nghiệm và đánh giá từ các thợ đã xác minh.'],
  ['03', 'Sửa chữa an tâm', 'Theo dõi tiến độ, thanh toán và đánh giá ngay trên FixMate.'],
];

export default function PublicHome({ services, onStart }) {
  const [technicians, setTechnicians] = useState([]);
  const [selectedTechnician, setSelectedTechnician] = useState(null);

  async function findTechnicians(event) {
    if (event) event.preventDefault();
    const data = event ? Object.fromEntries(new FormData(event.currentTarget)) : {};
    const query = new URLSearchParams();
    if (data.serviceId) query.set('serviceId', data.serviceId);
    if (data.area) query.set('area', data.area);
    const result = await api('/technicians?' + query.toString());
    setTechnicians(result.items);
  }

  async function viewTechnician(userId) {
    const result = await api('/technicians/' + userId);
    setSelectedTechnician(result);
  }

  useEffect(() => { findTechnicians().catch(() => {}); }, []);

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

      <section className="section shell technician-search">
        <div className="section-heading"><div><span className="eyebrow">Thợ đã xác minh</span><h2>Tìm đúng chuyên môn</h2></div><p>Lọc theo dịch vụ và khu vực trước khi tạo yêu cầu.</p></div>
        <form className="inline-search-form" onSubmit={findTechnicians}>
          <select name="serviceId" defaultValue=""><option value="">Mọi dịch vụ</option>{services.map((service) => <option key={idOf(service)} value={idOf(service)}>{service.name}</option>)}</select>
          <input name="area" placeholder="Quận/Huyện hoặc Thành phố" />
          <button className="button primary">Tìm thợ</button>
        </form>
        <div className="service-grid technician-public-grid">
          {technicians.map((profile) => <article className="service-card" key={idOf(profile)}>
            <span className="service-index">{profile.ratingAverage?.toFixed?.(1) || '0.0'} ★</span>
            <div className="service-icon">{profile.user?.name?.slice(0, 1) || 'T'}</div>
            <h3>{profile.user?.name}</h3><p>{profile.bio}</p>
            <div className="tag-row">{profile.serviceIds?.map((service) => <span key={idOf(service)}>{service.name}</span>)}</div>
            <footer><span>{profile.area}</span><button onClick={() => viewTechnician(idOf(profile.user))} aria-label="Xem hồ sơ thợ">↗</button></footer>
          </article>)}
        </div>
        {selectedTechnician && <section className="panel technician-detail">
          <div className="panel-heading-row"><div><h3>{selectedTechnician.technician.user?.name}</h3><p>{selectedTechnician.technician.bio}</p></div><button className="icon-button" onClick={() => setSelectedTechnician(null)} aria-label="Đóng hồ sơ">×</button></div>
          <div className="item-list">{selectedTechnician.reviews.length === 0 ? <p>Chưa có đánh giá.</p> : selectedTechnician.reviews.map((review) => <article className="list-card" key={idOf(review)}><b>{review.rating}/5 ★ · {review.customer?.name}</b><p>{review.comment}</p></article>)}</div>
        </section>}
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
