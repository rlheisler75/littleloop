import { useEffect } from 'react';
import LoopMark from '../../components/ui/LoopMark';

export const LEGAL_UPDATED = 'November 15, 2026';
export const SUPPORT_EMAIL = 'littleloop@loopwaresolutions.com';
const COMPANY = 'Loopware Solutions LLC';

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&family=Nunito:wght@400;600;700;800&display=swap');
.ll-legal{min-height:100vh;background:#FFFBF3;color:#22244D;font-family:'Nunito',sans-serif;padding:0 16px 64px}
.ll-legal *{box-sizing:border-box}
.ll-legal-nav{max-width:760px;margin:0 auto;padding:18px 0;display:flex;align-items:center;justify-content:space-between;gap:12px}
.ll-legal-brand{display:inline-flex;align-items:center;gap:8px;font:600 22px 'Fredoka',sans-serif;color:#2B2D6B;text-decoration:none}
.ll-legal-tabs{display:flex;gap:6px}
.ll-legal-tabs a{font:700 13px 'Nunito',sans-serif;color:#4A4E8F;text-decoration:none;padding:7px 12px;border-radius:100px}
.ll-legal-tabs a.on{background:#fff;color:#E04E3A;box-shadow:0 2px 8px rgba(43,45,107,.08)}
.ll-legal-card{max-width:760px;margin:0 auto;background:#fff;border-radius:24px;border:2px solid #F3EDE3;padding:32px 28px;box-shadow:0 12px 40px rgba(43,45,107,.06)}
.ll-legal h1{font:600 32px 'Fredoka',sans-serif;color:#2B2D6B;margin:0 0 4px}
.ll-legal .upd{font-size:13px;color:#686B90;margin-bottom:22px}
.ll-legal h2{font:600 19px 'Fredoka',sans-serif;color:#2B2D6B;margin:26px 0 8px}
.ll-legal p,.ll-legal li{font-size:15px;line-height:1.7;color:#3A3D66}
.ll-legal ul{padding-left:20px;margin:6px 0 10px}
.ll-legal li{margin-bottom:4px}
.ll-legal a{color:#1F7FC0}
.ll-legal .sum{background:#FFF6E5;border-radius:16px;padding:14px 16px;margin-bottom:8px}
.ll-legal .sum p{margin:0;font-size:14px}
@media (max-width:560px){.ll-legal-card{padding:24px 18px}.ll-legal h1{font-size:26px}}
`;

const Mail = () => <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

function Privacy() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <div className="upd">Last updated {LEGAL_UPDATED}</div>
      <div className="sum"><p><strong>The short version:</strong> littleloop exists so a family and their sitter can share their children's day privately. Your information is shared only with the people in your loop: your family and the sitters you connect with. We don't sell your data, we don't show ads, and we don't use your children's information for marketing.</p></div>

      <h2>Who we are</h2>
      <p>littleloop is operated by {COMPANY} ("we", "us"). Questions about this policy: <Mail/>.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> name, email address, password (stored encrypted by our authentication provider) and the role you sign up as (sitter or parent).</li>
        <li><strong>Children's information, entered by a parent or guardian:</strong> name, date of birth, photo, allergies, dietary needs, medical notes, medications, doctor and hospital details and, optionally, insurance details.</li>
        <li><strong>Family contacts:</strong> parents/guardians, emergency contacts and approved pickup people, with their phone numbers and, optionally, email addresses, plus a home address if you add one.</li>
        <li><strong>Care activity:</strong> check-in and check-out times, schedules, photo and activity posts, comments, messages, notes and invoices.</li>
        <li><strong>Location:</strong> only when a sitter starts a Field Trip, the sitter's device location is shared with the connected families until the trip ends, and the route is saved so families can see where the group went. When a parent taps "On My Way", their estimated arrival is shared with their sitter. We don't track location at any other time.</li>
        <li><strong>Agreements:</strong> care agreements, typed-name signatures with the date and the signer's account, and any signed paper copies a sitter uploads.</li>
        <li><strong>Sitter details:</strong> public profile information a sitter chooses to publish, verification documents a sitter uploads (such as a background check or CPR card), payment handles (such as a Venmo username) and, for year-end tax statements, a sitter's legal name, address and taxpayer ID.</li>
        <li><strong>Billing:</strong> if a sitter subscribes to Pro, payment is handled by Stripe. We never see or store full card numbers.</li>
        <li><strong>Usage data:</strong> basic, cookie-free page analytics (pages visited, referring site, device type and country) to understand how people find and use littleloop.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run littleloop: showing your family's information to your connected sitters and family members, and sending check-in, message, invoice and reminder notifications.</li>
        <li>To keep accounts secure, prevent abuse and fix problems.</li>
        <li>To review sitter verification documents when a sitter asks to be verified.</li>
        <li>To email you about your account. You can turn off optional emails and push notifications in your settings.</li>
      </ul>
      <p>We do not sell or rent personal information, and we do not share it with advertisers.</p>

      <h2>Who can see what</h2>
      <ul>
        <li><strong>Your family's members</strong> can see your family's children, contacts, posts, check-ins, agreements and invoices.</li>
        <li><strong>Sitters you're connected with</strong> can see your children's profiles and emergency information, family contacts, and the posts, messages, invoices and agreements between you and that sitter. When a family and a sitter disconnect, the sitter loses access to the family's information.</li>
        <li><strong>The public</strong> can only see a sitter's profile, and only if that sitter turns their public profile on.</li>
        <li><strong>littleloop staff</strong> can access data only when needed to support you, review a verification document, or keep the service secure.</li>
      </ul>

      <h2>Service providers</h2>
      <p>We use trusted providers to run littleloop. They process data only on our behalf:</p>
      <ul>
        <li>Supabase (database, file storage and sign-in)</li>
        <li>Vercel (website hosting and cookie-free analytics)</li>
        <li>Resend (email delivery)</li>
        <li>Google Firebase Cloud Messaging (push notifications)</li>
        <li>Stripe (Pro subscription payments)</li>
        <li>OpenStreetMap (map images on Field Trip maps; your device requests map tiles directly)</li>
      </ul>
      <p>Payments between families and sitters (such as Venmo, Cash App or PayPal) happen in those apps, under their own privacy policies. littleloop only opens the app with the amount filled in.</p>
      <p>We may disclose information if required by law, or to protect the safety of a child or another person.</p>

      <h2>Children's privacy</h2>
      <p>littleloop is used by adults: parents, guardians and childcare providers. It is not directed to children, and children should not create accounts. Children's information is entered by their parent or guardian, or by their sitter at the parent's direction, so that the people caring for the child have what they need. A parent or guardian can review, correct or delete their child's information at any time from the app, or by emailing <Mail/>.</p>

      <h2>Keeping it safe</h2>
      <p>Data is encrypted in transit and stored with access rules that limit each record to the family and sitters it belongs to. Signed paper copies and verification documents are kept in private storage. No system is perfectly secure, so please use a strong, unique password.</p>

      <h2>How long we keep it</h2>
      <p>We keep your information while your account is active. Anyone can delete their account from Profile → Delete Account. When the last member of a family deletes their account, the family's children, photos, posts, messages, check-ins, emergency information and agreements are deleted too, and connected sitters lose access. Invoices are kept so the sitter has their payment records. Parents can also remove children and contacts at any time. Deleted data is removed from our systems within 30 days, except records we must keep by law (such as payment records) and routine backups, which expire on their own schedule.</p>

      <h2>Your choices and rights</h2>
      <p>You can view and edit most of your information in the app. You can also email <Mail/> to request a copy of your data, a correction, or deletion. We'll respond within 30 days.</p>

      <h2>Changes</h2>
      <p>If we make meaningful changes to this policy, we'll update the date above and let you know in the app or by email.</p>
    </>
  );
}

function Terms() {
  return (
    <>
      <h1>Terms of Service</h1>
      <div className="upd">Last updated {LEGAL_UPDATED}</div>
      <div className="sum"><p><strong>The short version:</strong> littleloop is a tool that helps independent sitters and families stay organized. We are not a childcare agency. Sitters and families make their own arrangements with each other, and each is responsible for their own choices.</p></div>

      <h2>Agreeing to these terms</h2>
      <p>These terms are an agreement between you and {COMPANY}. By creating an account or using littleloop you agree to them and to our <a href="/privacy">Privacy Policy</a>. You must be at least 18 to use littleloop.</p>

      <h2>What littleloop is, and isn't</h2>
      <ul>
        <li>littleloop provides software for check-ins, updates, messaging, scheduling, invoices, care agreements and Field Trip location sharing.</li>
        <li><strong>We do not provide childcare, and we do not employ, recommend, supervise or guarantee any sitter.</strong> Sitters are independent. Families are responsible for choosing a sitter and checking references, licensing and background.</li>
        <li>A "verified" badge means a sitter uploaded a document that we looked at. It is not a guarantee of identity, qualifications or conduct.</li>
        <li>Childcare licensing rules vary by state. Sitters are responsible for following the laws that apply to them.</li>
      </ul>

      <h2>Your account</h2>
      <p>Keep your login details private and give accurate information. You're responsible for activity on your account. Tell us at <Mail/> if you think someone else has accessed it.</p>

      <h2>Families and sitters</h2>
      <ul>
        <li><strong>Payments:</strong> invoices in littleloop are records between a family and a sitter. Payments are made directly between them (for example by cash, Venmo or Cash App). littleloop is not a party to those payments and does not handle refunds or disputes about them.</li>
        <li><strong>Care agreements:</strong> the agreement template is a general starting point, not legal advice. Sitters are responsible for the content of their own agreements. When you type your name and confirm, that counts as your electronic signature on that agreement.</li>
        <li><strong>Emergency information:</strong> parents are responsible for keeping children's medical details, contacts and pickup permissions accurate and up to date. littleloop is not an emergency service. In an emergency, call 911.</li>
        <li><strong>Location:</strong> Field Trip and arrival-time locations depend on the device and network, and may be delayed or inaccurate. Don't rely on them as the only way to know where a child is.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Don't use littleloop to break the law, harass anyone, share content you don't have the right to share, post sexual or exploitative content of any kind, impersonate someone, or try to access data that isn't yours. We may suspend or close accounts that break these rules or put children at risk, and we may report suspected harm to children to the authorities.</p>

      <h2>Your content</h2>
      <p>You own the photos, posts, messages and other content you add. You give us permission to store, display and send that content to the people you share it with, as needed to run littleloop. You're responsible for having permission to share any photo you post.</p>

      <h2>Pro subscriptions</h2>
      <ul>
        <li>Sitters can use littleloop free with up to 2 families. Pro (currently $5/month or $50/year) adds unlimited families and extra features. Families always use littleloop free.</li>
        <li>Pro renews automatically until you cancel. You can cancel at any time from the Plan tab, and Pro stays active until the end of the period you paid for. We don't give refunds for partial periods unless the law requires it.</li>
        <li>We'll give at least 30 days' notice before changing the price of an existing subscription.</li>
      </ul>

      <h2>Ending your account</h2>
      <p>You can stop using littleloop at any time and delete your account from Profile → Delete Account. We may suspend or end access if these terms are broken, or if we stop offering the service, in which case we'll give reasonable notice where we can so you can save your records.</p>

      <h2>Disclaimers</h2>
      <p>littleloop is provided "as is". We work hard to keep it running and accurate, but we don't promise it will always be available, error-free or secure, and we don't guarantee the conduct of any user.</p>

      <h2>Limitation of liability</h2>
      <p>To the fullest extent the law allows, {COMPANY} is not liable for indirect or consequential damages, or for anything arising from the care arrangements, conduct or payments between families and sitters. Our total liability for any claim relating to littleloop is limited to the greater of the amount you paid us in the 12 months before the claim, or $50. Some places don't allow these limits, so they may not apply to you.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the State of Missouri. Any dispute will be handled in the state or federal courts located in Greene County, Missouri, unless the law where you live requires otherwise.</p>

      <h2>Changes</h2>
      <p>We may update these terms. If a change is meaningful, we'll update the date above and let you know in the app or by email. Continuing to use littleloop after a change means you accept the updated terms.</p>

      <h2>Contact</h2>
      <p>{COMPANY} · <Mail/></p>
    </>
  );
}

export default function LegalPage({ page }) {
  useEffect(() => {
    const prev = document.title;
    document.title = page === 'terms' ? 'Terms of Service · littleloop' : 'Privacy Policy · littleloop';
    window.scrollTo(0, 0);
    return () => { document.title = prev; };
  }, [page]);

  return (
    <div className="ll-legal">
      <style>{STYLES}</style>
      <nav className="ll-legal-nav">
        <a className="ll-legal-brand" href="/"><LoopMark size={18} color="#E8553F"/>littleloop</a>
        <div className="ll-legal-tabs">
          <a href="/privacy" className={page === 'privacy' ? 'on' : ''}>Privacy</a>
          <a href="/terms" className={page === 'terms' ? 'on' : ''}>Terms</a>
        </div>
      </nav>
      <main className="ll-legal-card">{page === 'terms' ? <Terms/> : <Privacy/>}</main>
    </div>
  );
}

export function legalPageFromPath() {
  const p = window.location.pathname.replace(/\/+$/, '');
  return p === '/privacy' ? 'privacy' : p === '/terms' ? 'terms' : null;
}
