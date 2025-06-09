// client/src/pages/info/ContactPage.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import '../../assets/css/InfoPage.css'; // Re-use for general styling
import '../../assets/css/ContactPage.css'; // Specific styles for contact form

const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [status, setStatus] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Sending...');
    // Replace with your actual form submission logic (e.g., API call to backend or Formspree/Netlify Forms)
    // Example:
    // try {
    //   const response = await fetch('YOUR_BACKEND_ENDPOINT_OR_FORM_SERVICE', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(formData),
    //   });
    //   if (response.ok) {
    //     setStatus('Message sent successfully! We will get back to you soon.');
    //     setFormData({ name: '', email: '', subject: '', message: '' });
    //   } else {
    //     setStatus('Failed to send message. Please try again or email us directly.');
    //   }
    // } catch (error) {
    //   setStatus('An error occurred. Please try again or email us directly.');
    // }
    setTimeout(() => { // Simulate submission
        setStatus(`Thank you, ${formData.name}! Your message about "${formData.subject}" has been "sent" (this is a placeholder). We'll be in touch at ${formData.email} if needed.`);
        setFormData({ name: '', email: '', subject: '', message: '' });
    }, 1500);
  };

  return (
    <>
      <Helmet>
        <title>Contact Us - sigmaMIDI</title>
        <meta name="description" content="Get in touch with the sigmaMIDI team for support, inquiries, or feedback." />
      </Helmet>
      <div className="info-page-container container">
        <header className="info-page-header">
          <h1>Contact Us</h1>
          <p>Have a question, suggestion, or just want to say hello? We'd love to hear from you!</p>
        </header>
        <section className="info-page-content contact-section">
          <div className="contact-methods">
            <div className="contact-method-item">
              <h3>General Inquiries & Support</h3>
              <p>For general questions, technical support, or feedback about the platform:</p>
              <p><strong>Email:</strong> <a href="mailto:info@sigmamidi.com">info@sigmamidi.com</a></p>
              {/* <p><strong>Community Forum:</strong> <a href="/community">Visit our Forums</a> (if you have one)</p> */}
            </div>
            <div className="contact-method-item">
              <h3>Copyright Concerns</h3>
              <p>To report a copyright infringement or for DMCA notices, please email:</p>
              <p><strong>Email:</strong> <a href="mailto:copyright@sigmamidi.com">copyright@sigmamidi.com</a></p>
              <p>Please include all necessary information as outlined in our <Link href="/terms">Terms of Service</Link>.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="contact-form">
            <h2>Send us a Message</h2>
            <div className="form-group">
              <label htmlFor="name">Your Name</label>
              <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="email">Your Email</label>
              <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="subject">Subject</label>
              <input type="text" id="subject" name="subject" value={formData.subject} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="message">Message</label>
              <textarea id="message" name="message" rows="6" value={formData.message} onChange={handleChange} required></textarea>
            </div>
            <button type="submit" className="btn btn-primary btn-submit-contact" disabled={status === 'Sending...'}>
              {status === 'Sending...' ? 'Sending...' : 'Send Message'}
            </button>
            {status && <p className={`contact-status ${status.includes('Failed') || status.includes('error') ? 'error' : 'success'}`}>{status}</p>}
          </form>
        </section>
      </div>
    </>
  );
};

export default ContactPage;