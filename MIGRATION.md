# littleloop — Supabase Migration Guide
## Connecting the React app to the real backend

---

## 1. Project setup

```bash
# In your project root
npm create vite@latest littleloop -- --template react
cd littleloop
npm install @supabase/supabase-js
npm install        # install everything else
```

Create `.env.local` in the project root — **never commit this file**:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Both values live in:
**Supabase Dashboard → Your Project → Settings → API**

Add `.env.local` to `.gitignore`:
```
echo ".env.local" >> .gitignore
```

---

## 2. File structure

Copy these new files into your project:

```
src/
  lib/
    supabase.js          ← Supabase client singleton
  hooks/
    useAuth.js           ← login, signup, session management
    useSitterData.js     ← all sitter DB reads + writes
    useParentData.js     ← all parent DB reads + writes
  components/
    AuthScreen.jsx       ← login/signup UI
  App.jsx                ← new root with auth routing
```

---

## 3. Enable Realtime in Supabase

In **Supabase Dashboard → Database → Replication**, enable these tables
(click the toggle next to each):

- `posts`
- `messages`
- `checkins`
- `post_likes`
- `payments`

Or run this SQL:

```sql
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.checkins;
alter publication supabase_realtime add table public.post_likes;
alter publication supabase_realtime add table public.payments;
```

---

## 4. SitterApp.jsx — changes needed

### Before (fake state)
```jsx
function SitterApp({ db, setDb, pushNotif }) {
  // reads from db.families, db.posts, etc.
  // mutates via setDb(d => ...)
}
```

### After (real data)
```jsx
import { useSitterData } from "./hooks/useSitterData";

function SitterApp({ sitterId }) {
  const { data, loading, error, actions } = useSitterData(sitterId);

  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorBanner message={error} />;

  const { sitter, families, members, children, posts, messages, invoices } = data;
  // ... rest of component unchanged
}
```

### Mutation mapping — replace these `setDb` calls:

| Old (setDb)                        | New (actions)                                  |
|------------------------------------|------------------------------------------------|
| `submitPost()`                     | `await actions.createPost({ familyId, childIds, type, mood, text, photoFile })` |
| `submitInvite()`                   | `await actions.inviteFamily({ familyName, adminEmail, childNames })` |
| `submitInvoice()`                  | `await actions.createInvoice({ familyId, type, ... })` |
| `addPayment(invoiceId, payment)`   | `await actions.recordPayment({ invoiceId, amount, method, note })` |
| `markFullyPaid(invoiceId)`         | Calculate remaining, then `await actions.recordPayment({ invoiceId, amount: remaining, method: "Manual", note: "Marked as fully paid" })` |
| `sendMsg()`                        | `await actions.sendMessage({ familyId: activeMsg, text: msgInput })` |
| `updateMemberRole(id, role)`       | `await actions.updateMemberRole(memberId, newRole)` |
| `removeMember(id)`                 | `await actions.removeMember(memberId)` |

### Data shape changes — snake_case from DB:

The DB returns snake_case column names. Map them when reading:

| App currently uses   | DB returns          |
|----------------------|---------------------|
| `fam.adminEmail`     | `fam.admin_email`   |
| `post.timestamp`     | `post.created_at`   |
| `post.childIds`      | `post.post_children.map(pc => pc.child_id)` |
| `post.likes`         | `post.post_likes`   |
| `inv.familyId`       | `inv.family_id`     |
| `inv.issuedDate`     | `inv.issued_date`   |
| `inv.dueDate`        | `inv.due_date`      |
| `inv.tuitionRate`    | `inv.tuition_rate`  |
| `inv.tuitionPeriod`  | `inv.tuition_period`|
| `payment.date`       | `payment.paid_date` |
| `child.medicalNotes` | `child.medical_notes` |
| `child.behavioralNotes` | `child.behavioral_notes` |
| `child.dietaryRestrictions` | `child.dietary_restrictions` |
| `child.photo`        | `child.photo_url`   |
| `member.familyId`    | `member.family_id`  |

**Tip:** The quickest approach is a small adapter function at the top of each component:

```js
// Normalise a DB post to the shape the component expects
function normalisePost(p) {
  return {
    ...p,
    childIds:  p.post_children?.map(pc => pc.child_id) ?? [],
    likes:     Object.fromEntries((p.post_likes ?? []).map(l => [l.member_id, true])),
    timestamp: new Date(p.created_at).getTime(),
  };
}
```

---

## 5. ParentApp.jsx — changes needed

### Before
```jsx
function ParentApp({ db, setDb, pushNotif }) { ... }
```

### After
```jsx
import { useParentData } from "./hooks/useParentData";

function ParentApp({ userId }) {
  const { data, loading, error, actions } = useParentData(userId);

  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorBanner message={error} />;

  const { member, family, members, children, posts, messages, invoices } = data;
  // member replaces the old "me" + activeMemberId switcher
  // family is directly the current user's family
}
```

### Key difference: no more member switcher

In the demo, parents could switch between family members. In the real app, each person logs in as themselves. Remove the member switcher from the parent header and use `member` directly everywhere `me` / `db.members[activeMemberId]` was used.

### Mutation mapping:

| Old (setDb)                              | New (actions)                             |
|------------------------------------------|-------------------------------------------|
| `sendMsg()`                              | `await actions.sendMessage(text)`         |
| `toggleLike(postId)`                     | `await actions.toggleLike(postId)`        |
| `toggleCheckin(childId)`                 | `await actions.toggleCheckin(childId)`    |
| `addPayment(invoiceId, payment)`         | `await actions.recordPayment({ invoiceId, amount, method, note })` |
| `saveChildProfile(updated)`              | `await actions.updateChild(childId, updated)` |
| Photo upload for child                   | `await actions.uploadChildPhoto(childId, file)` |
| `inviteMember(...)`                      | `await actions.inviteMember({ name, email, avatar, role })` |
| `updateMemberRole(id, role)`             | `await actions.updateMemberRole(memberId, newRole)` |
| `removeMember(id)`                       | `await actions.removeMember(memberId)`    |

---

## 6. Notifications — replacing pushNotif()

The current `pushNotif()` is a local UI thing that sends toast messages
to the other panel. In the real app, use Supabase Realtime — both sides
are subscribed and receive live updates automatically.

For **push notifications** (phone notifications when the app is closed),
add this later via a Supabase Edge Function + a service like [Expo](https://expo.dev)
(if you go mobile) or [web-push](https://www.npmjs.com/package/web-push).

For now, the realtime subscriptions in the hooks replace `pushNotif` entirely
— the sitter sees parent messages appear in real time, and vice versa.

---

## 7. Photo uploads — replacing base64

The app currently stores photos as base64 data URLs in state (huge, not scalable).
The new hooks upload to Supabase Storage and store a URL instead.

For post photos in `SitterApp`, change the `PhotoUpload` component to
pass the raw `File` object instead of a base64 string:

```jsx
// Old PhotoUpload — converts to base64
function PhotoUpload({ onPhoto }) {
  const handleChange = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = ev => onPhoto(ev.target.result);  // base64
    reader.readAsDataURL(file);
  };
  ...
}

// New PhotoUpload — passes raw File
function PhotoUpload({ onPhoto }) {
  const handleChange = e => {
    const file = e.target.files[0];
    onPhoto(file);   // File object — hook uploads it to Storage
  };
  ...
}
```

Then in `createPost`, pass `photoFile` instead of `photo`:
```js
await actions.createPost({ familyId, childIds, type, mood, text, photoFile: selectedFile });
```

---

## 8. Invoice total calculations

The DB has an `invoice_totals` view that calculates totals server-side.
Your existing `invoiceTotal()`, `amountPaid()`, and `invoiceStatus()`
helper functions still work perfectly — they just read from the payment
and extras arrays that come back nested in the invoice query. No change needed.

---

## 9. Summary report — date range filter

The `getReportInvoices()` function in SitterApp currently filters in JS.
With real data, it still works the same way since all invoices are already loaded.

For very large datasets (hundreds of invoices), switch to a DB-filtered query:

```js
// In useSitterData, add a filtered fetch action:
async function fetchInvoiceReport({ fromDate, toDate, familyId }) {
  let query = supabase
    .from("invoices")
    .select("*, invoice_extras(*), payments(*)")
    .eq("sitter_id", sitterId)
    .gte("issued_date", fromDate)
    .lte("issued_date", toDate)
    .order("issued_date");

  if (familyId !== "all") query = query.eq("family_id", familyId);

  const { data, error } = await query;
  return { data, error };
}
```

---

## 10. Running locally

```bash
npm run dev
```

Open `http://localhost:5173`. Sign up as a sitter first, then invite a family,
then open a private/incognito window and sign up as the parent.

---

## 11. Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from your project root
vercel

# Add environment variables in Vercel dashboard:
# Settings → Environment Variables:
#   VITE_SUPABASE_URL      = your Supabase URL
#   VITE_SUPABASE_ANON_KEY = your anon key
```

Or connect your GitHub repo in the Vercel dashboard for automatic
deploys on every push to main.

---

## 12. What's NOT included yet (next steps)

| Feature                     | How to add it                                         |
|-----------------------------|-------------------------------------------------------|
| Email invite to parents     | Supabase Edge Function + Resend or Mailgun            |
| Push notifications          | web-push (PWA) or Expo (mobile)                       |
| Password reset              | `supabase.auth.resetPasswordForEmail(email)`          |
| Stripe payments             | Supabase Edge Function + Stripe SDK                   |
| Family deactivation         | Set `families.status = 'inactive'`, RLS already scopes|
| Export to PDF (server-side) | Edge Function generating PDF with puppeteer           |
| Mobile app                  | Wrap in Expo / Capacitor, same Supabase client works  |
