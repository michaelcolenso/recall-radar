export const homeTemplate = (makes: Array<{ slug: string; name: string }>): string => `
<section class="card">
  <h2>Browse Recalls by Make</h2>
  <ul>${makes.map((m) => `<li><a href="/make/${m.slug}">${m.name}</a></li>`).join("")}</ul>
</section>`;
