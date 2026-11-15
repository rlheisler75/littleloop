// Retired debug endpoint. It used to list every push subscription and send a test
// push to all users without authentication. Kept as a stub so the URL returns 410.
Deno.serve(() => new Response(JSON.stringify({ error: 'Gone' }), {
  status: 410,
  headers: { 'Content-Type': 'application/json' },
}));
