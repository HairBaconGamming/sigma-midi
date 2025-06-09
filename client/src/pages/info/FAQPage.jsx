// client/src/pages/info/FAQPage.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import '../../assets/css/InfoPage.css';

const FAQPage = () => {
  return (
    <>
      <Helmet>
        <title>FAQ - sigmaMIDI</title>
        <meta name="description" content="Find answers to frequently asked questions about sigmaMIDI, uploading files, account management, and more." />
      </Helmet>
      <div className="info-page-container container">
        <header className="info-page-header">
          <h1>Frequently Asked Questions</h1>
        </header>
        <section className="info-page-content">
          <h2>General</h2>
          <div className="faq-item">
            <h3>What is sigmaMIDI?</h3>
            <p>sigmaMIDI is a web platform for sharing, discovering, and playing MIDI files. It's a community-driven repository for musicians and music enthusiasts.</p>
          </div>
          <div className="faq-item">
            <h3>Is sigmaMIDI free to use?</h3>
            <p>Yes, sigmaMIDI is currently free for uploading, downloading, and browsing MIDI files. We may introduce premium features in the future, but core functionality will remain accessible.</p>
          </div>

          <h2>Uploading MIDIs</h2>
          <div className="faq-item">
            <h3>What kind of files can I upload?</h3>
            <p>You can upload standard MIDI files with `.mid` or `.midi` extensions. The maximum file size is currently 15MB.</p>
          </div>
          <div className="faq-item">
            <h3>Do I need an account to upload?</h3>
            <p>Yes, you need to register for a free account to upload MIDI files. This helps us manage contributions and give credit to uploaders.</p>
          </div>
          <div className="faq-item">
            <h3>Can I edit the details of my uploaded MIDIs?</h3>
            <p>Yes, you can edit the title, artist, description, and other metadata of your uploaded MIDIs through your "My MIDIs" page (feature to be fully implemented).</p>
          </div>

          <h2>Downloading & Playing</h2>
          <div className="faq-item">
            <h3>How do I download a MIDI file?</h3>
            <p>On each MIDI's detail page, or on the MIDI cards, there is a download button. Clicking it will start the download.</p>
          </div>
          <div className="faq-item">
            <h3>Can I play MIDIs directly on the website?</h3>
            <p>Yes, sigmaMIDI features an integrated web player (the MiniPlayerBar) that allows you to preview and listen to MIDIs directly in your browser.</p>
          </div>
          <div className="faq-item">
            <h3>What is the sigmaMIDI Desktop Player?</h3>
            <p>The sigmaMIDI Desktop Player is a dedicated application for Windows that offers enhanced MIDI playback features, local file playback, and special integrations like "Play on Roblox." You can download it from the <a href="/desktop-app">Desktop App page</a>.</p>
          </div>
          
          <h2>Account & Profile</h2>
          <div className="faq-item">
            <h3>How do I change my password or email?</h3>
            <p>Currently, password and email changes are not directly available through the profile page. Please <a href="/contact">contact support</a> for assistance with account modifications (this feature will be added later).</p>
          </div>

          <h2>Copyright & Licensing</h2>
          <div className="faq-item">
            <h3>What about copyright for uploaded MIDIs?</h3>
            <p>Users are responsible for ensuring they have the rights to upload the MIDI files they share. Please respect copyright laws. If you believe a file infringes on your copyright, please refer to our <a href="/terms">Terms of Service</a> and <a href="/contact">contact us</a>.</p>
          </div>
          
          <h2>Contact</h2>
          <div className="faq-item">
            <h3>I have another question. How can I contact you?</h3>
            <p>Please visit our <Link to="/contact">Contact page</Link> for ways to get in touch with the sigmaMIDI team.</p>
          </div>
        </section>
      </div>
    </>
  );
};

export default FAQPage;