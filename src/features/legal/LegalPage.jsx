import { useEffect } from 'react';
import LoopMark from '../../components/ui/LoopMark';
import { FREE_CHILD_LIMIT, SITTER_TIERS, DAYCARE_TIERS, DAYCARE_TRIAL_DAYS } from '../../lib/plan';

export const LEGAL_UPDATED = 'November 25, 2026';   // online tuition payments (4C) added the same day
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

// e.g. "$7/month (up to 10 children)", from the same price list the app uses (src/lib/plan.js)
const tierText = t => `$${t.monthly}/month (${t.children ? `up to ${t.children} children` : 'unlimited children'})`;

function Privacy() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <div className="upd">Last updated {LEGAL_UPDATED}</div>
      <div className="sum"><p><strong>The short version:</strong> littleloop exists so families and the people who care for their children, independent sitters and daycare centers, can share each child's day privately. Your information is shared only with the people in your loop: your family, the sitters you connect with, and the daycare your family connects to. We don't sell your data, we don't show ads, and we don't use your children's information for marketing.</p></div>

      <h2>Who we are</h2>
      <p>littleloop is operated by {COMPANY} ("we", "us"). Questions about this policy: <Mail/>.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> name, email address, password (stored encrypted by our authentication provider) and how you use littleloop (as a sitter, a parent, or a daycare's staff).</li>
        <li><strong>Children's information, entered by a parent or guardian:</strong> name, date of birth, photo, allergies, dietary needs, medical notes, medications, doctor and hospital details and, optionally, insurance details.</li>
        <li><strong>Family contacts:</strong> parents/guardians, emergency contacts and approved pickup people, with their phone numbers and, optionally, email addresses, plus a home address if you add one.</li>
        <li><strong>Care activity:</strong> check-in and check-out times, schedules, photo and activity posts, comments, messages, notes and invoices.</li>
        <li><strong>Daycare records,</strong> if your family connects to a daycare that uses littleloop: your child's classroom and enrollment details; forms you sign and documents you upload for the enrollment packet (such as immunization records and doctor's notes); photo consent; what staff log during the day (meals, bottles, naps, diapers, moods, activities and medicine given) and the daily report; incident reports and your signature on them; the classroom's lesson plans; and your child's skills progress and report cards.</li>
        <li><strong>Daycare staff details:</strong> a staff member's name, email, role (director, office or teacher), home classroom, and when they join or leave a classroom during the day, so the daycare can keep its child-to-staff ratios.</li>
        <li><strong>Location:</strong> only when a sitter starts a Field Trip, the sitter's device location is shared with the connected families until the trip ends, and the route is saved so families can see where the group went. When a parent taps "On My Way", their estimated arrival is shared with their sitter. When daycare staff clock in or out with the time clock, the phone's location at that moment is saved with the punch so the daycare can confirm it was made on site; the director and office can see it. We don't track location at any other time.</li>
        <li><strong>Agreements:</strong> care agreements, typed-name signatures with the date and the signer's account, and any signed paper copies a sitter uploads.</li>
        <li><strong>Sitter details:</strong> public profile information a sitter chooses to publish, verification documents a sitter uploads (such as a background check or CPR card), payment handles (such as a Venmo username) and, for year-end tax statements, a sitter's legal name, address and taxpayer ID.</li>
        <li><strong>Billing:</strong> when a sitter or a daycare subscribes to a paid plan, payment is handled by Stripe. We never see or store full card numbers.</li>
        <li><strong>Online tuition payments:</strong> when a daycare takes payments online, the daycare sets up its own Stripe account on Stripe's site, and parents enter card or bank details on Stripe's payment page. littleloop never sees or stores card numbers, bank account numbers or the daycare's identity documents. We keep the amount, date, whether it was a card or bank payment, its status (such as paid, refunded or disputed) and Stripe's reference numbers, so the payment shows on the family's account.</li>
        <li><strong>Usage data:</strong> basic, cookie-free page analytics (pages visited, referring site, device type and country) to understand how people find and use littleloop.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run littleloop: showing your family's information to your connected sitters, your daycare and your family members, and sending check-in, report, message, invoice and reminder notifications.</li>
        <li>To let a daycare run its classrooms: check-ins and ratios, daily and incident reports, enrollment records, lesson plans and report cards.</li>
        <li>To keep accounts secure, prevent abuse and fix problems.</li>
        <li>To review sitter verification documents when a sitter asks to be verified.</li>
        <li>To email you about your account. You can turn off optional emails and push notifications in your settings.</li>
      </ul>
      <p>We do not sell or rent personal information, and we do not share it with advertisers.</p>

      <h2>Who can see what</h2>
      <ul>
        <li><strong>Your family's members</strong> can see your family's children, contacts, posts, check-ins, agreements and invoices. Parents also see their children's daily reports, incident reports and report cards from a daycare, and everyone in the family can see the shared lesson plans for their child's classroom.</li>
        <li><strong>Sitters you're connected with</strong> can see your children's profiles and emergency information, family contacts, and the posts, messages, invoices and agreements between you and that sitter. When a family and a sitter disconnect, the sitter loses access to the family's information.</li>
        <li><strong>A daycare your family connects to:</strong> its staff can see your children's profiles, allergies and health details, your family members, and your emergency and pickup contacts, and they record your children's day. Enrollment documents and incident reports are limited to the director, the office and your child's own classroom teachers, and so are report cards. A daycare never sees your posts, messages or invoices with a sitter. If your family disconnects, the daycare's staff lose access to your family's information, but the daycare keeps the records it made while caring for your child, such as incident reports and report cards.</li>
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
        <li>Stripe (subscription payments for sitters and daycares, and daycares' online tuition payments)</li>
        <li>OpenStreetMap (map images on Field Trip maps; your device requests map tiles directly)</li>
      </ul>
      <p>Payments between families and sitters (such as Venmo, Cash App or PayPal) happen in those apps, under their own privacy policies. littleloop only opens the app with the amount filled in.</p>
      <p>We may disclose information if required by law, or to protect the safety of a child or another person.</p>

      <h2>Children's privacy</h2>
      <p>littleloop is used by adults: parents, guardians, sitters and daycare staff. It is not directed to children, and children should not create accounts. Children's information is entered by their parent or guardian, or recorded by their sitter or daycare while caring for them, so that the people caring for the child have what they need. A parent or guardian can review, correct or delete the information they entered at any time from the app, and can ask their daycare, or us at <Mail/>, about the daycare's records.</p>

      <h2>Keeping it safe</h2>
      <p>Data is encrypted in transit and stored with access rules that limit each record to the family, sitters and daycare it belongs to. Health documents, signed paper copies and verification documents are kept in private storage. Incident reports and sent report cards can't be changed or deleted by staff, only corrected with notes the family can see. No system is perfectly secure, so please use a strong, unique password.</p>

      <h2>How long we keep it</h2>
      <p>We keep your information while your account is active. Anyone can delete their account from Profile → Delete Account. When the last member of a family deletes their account, the family's children, photos, posts, messages, check-ins, emergency information and agreements are deleted too, and connected sitters and daycares lose access. Invoices are kept so the sitter has their payment records. Parents can also remove children and contacts at any time. Records a daycare made while caring for a child, such as incident reports and report cards, are kept with the daycare's account as its own records. Deleted data is removed from our systems within 30 days, except records we must keep by law (such as payment records) and routine backups, which expire on their own schedule.</p>

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
      <div className="sum"><p><strong>The short version:</strong> littleloop is software that helps independent sitters, daycare centers and families stay organized. We are not a childcare agency and we don't run any daycare. Sitters, daycares and families make their own arrangements with each other, and each is responsible for their own choices.</p></div>

      <h2>Agreeing to these terms</h2>
      <p>These terms are an agreement between you and {COMPANY}. By creating an account or using littleloop you agree to them and to our <a href="/privacy">Privacy Policy</a>. You must be at least 18 to use littleloop. If you set up littleloop for a daycare, you confirm you're allowed to agree to these terms for that daycare.</p>

      <h2>What littleloop is, and isn't</h2>
      <ul>
        <li>littleloop provides software for check-ins, updates, messaging, scheduling, invoices, care agreements and Field Trip location sharing and, for daycares, classroom ratios, daily and incident reports, enrollment packets, lesson plans, skills progress, report cards, tuition billing, bookkeeping reports and a staff time clock.</li>
        <li><strong>We do not provide childcare, and we do not employ, recommend, supervise or guarantee any sitter or daycare.</strong> Sitters and daycares are independent. Families are responsible for choosing care and checking references, licensing and background.</li>
        <li>A "verified" badge means a sitter uploaded a document that we looked at. It is not a guarantee of identity, qualifications or conduct.</li>
        <li>Childcare licensing rules vary by state. Sitters and daycares are responsible for following the laws that apply to them, including ratio, record-keeping and reporting rules. littleloop's ratio counts, reports and records are tools to help, not a guarantee of compliance.</li>
      </ul>

      <h2>Your account</h2>
      <p>Keep your login details private and give accurate information. You're responsible for activity on your account. Tell us at <Mail/> if you think someone else has accessed it.</p>

      <h2>Families, sitters and daycares</h2>
      <ul>
        <li><strong>Payments:</strong> invoices in littleloop are records between a family and a sitter. Payments are made directly between them (for example by cash, Venmo or Cash App). littleloop is not a party to those payments and does not handle refunds or disputes about them.</li>
        <li><strong>Online tuition payments:</strong> a daycare can let families pay its bills online. The daycare connects its own Stripe account and agrees to Stripe's terms with Stripe; the daycare is the seller, and payments go to the daycare's Stripe account, not to littleloop. Families pay the amount they choose, up to what they owe. littleloop records each payment on the family's account but is not a party to it: refunds, disputes and chargebacks are between the family, the daycare and Stripe.</li>
        <li><strong>Care agreements and signatures:</strong> the agreement template is a general starting point, not legal advice. Sitters and daycares are responsible for the content of their own agreements and forms. When you type your name and confirm, that counts as your electronic signature on that agreement, form or report.</li>
        <li><strong>Daycares:</strong> a daycare's director decides who joins as staff and what each person can do, and can remove a staff member's access at any time. Daily reports, incident reports, lesson plans and report cards are written by the daycare's staff, and the daycare is responsible for what they say.</li>
        <li><strong>Emergency information:</strong> parents are responsible for keeping children's medical details, contacts and pickup permissions accurate and up to date. littleloop is not an emergency service. In an emergency, call 911.</li>
        <li><strong>Location:</strong> Field Trip, arrival-time and time clock locations depend on the device and network, and may be delayed or inaccurate. Don't rely on them as the only way to know where a child is. The daycare is responsible for its staff timesheets, payroll and wage-and-hour compliance; littleloop's hours and overtime figures are a tool to help, not payroll or legal advice.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Don't use littleloop to break the law, harass anyone, share content you don't have the right to share, post sexual or exploitative content of any kind, impersonate someone, or try to access data that isn't yours. We may suspend or close accounts that break these rules or put children at risk, and we may report suspected harm to children to the authorities.</p>

      <h2>Your content</h2>
      <p>You own the photos, posts, messages and other content you add. You give us permission to store, display and send that content to the people you share it with, as needed to run littleloop. You're responsible for having permission to share any photo you post.</p>

      <h2>Plans and payment</h2>
      <ul>
        <li><strong>Families</strong> always use littleloop free.</li>
        <li><strong>Sitters</strong> can use littleloop free for up to {FREE_CHILD_LIMIT} children. Paid sitter plans are {SITTER_TIERS.map(tierText).join(', ')}, or ten times the monthly price for a year. A first paid plan may start with a free trial, shown at checkout.</li>
        <li><strong>Daycares</strong> get a {DAYCARE_TRIAL_DAYS}-day free trial with no card. Daycare plans are {DAYCARE_TIERS.map(t => `${t.label} ${tierText(t)}`).join(', ')}, or ten times the monthly price for a year, with unlimited staff. If the trial ends without a plan, the daycare's tools pause until one is chosen; nothing is deleted.</li>
        <li>Staff of a daycare that's on a plan or in its trial can use littleloop's sitter tools free while they work there.</li>
        <li>Plans renew automatically until you cancel. You can cancel at any time from the Plan tab (sitters) or Center → Plan &amp; billing (daycares), and the plan stays active until the end of the period you paid for. Switching plans is prorated. We don't give refunds for partial periods unless the law requires it.</li>
        <li>For daycares that take <strong>online tuition payments</strong>, littleloop keeps a platform fee of 0.25% of each payment, and Stripe charges the daycare its own processing fees. Both are taken out of the payment before it reaches the daycare's bank; families pay only what they owe. If a payment is fully refunded, Stripe's and littleloop's fees may not be returned, following Stripe's rules.</li>
        <li>We'll give at least 30 days' notice before changing the price of an existing subscription or the online payment fee.</li>
      </ul>

      <h2>Ending your account</h2>
      <p>You can stop using littleloop at any time and delete your account from Profile → Delete Account. We may suspend or end access if these terms are broken, or if we stop offering the service, in which case we'll give reasonable notice where we can so you can save your records.</p>

      <h2>Disclaimers</h2>
      <p>littleloop is provided "as is". We work hard to keep it running and accurate, but we don't promise it will always be available, error-free or secure, and we don't guarantee the conduct of any user.</p>

      <h2>Limitation of liability</h2>
      <p>To the fullest extent the law allows, {COMPANY} is not liable for indirect or consequential damages, or for anything arising from the care arrangements, conduct or payments between families, sitters and daycares. Our total liability for any claim relating to littleloop is limited to the greater of the amount you paid us in the 12 months before the claim, or $50. Some places don't allow these limits, so they may not apply to you.</p>

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
