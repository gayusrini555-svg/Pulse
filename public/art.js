// Pulse artwork: Pip the mascot and the six archetype doodle faces (original drawings).
(function () {
  const FACES = {
 "librarian": {
  "bg": "#C9D5FF",
  "inner": "<circle cx=\"60\" cy=\"27\" r=\"9\" fill=\"#262335\"></circle><path d=\"M60 34 C80 33 93 46 92 64 C91 84 78 97 60 97 C42 97 29 84 29 64 C30 46 42 35 60 34 Z\" fill=\"#FFF6E8\" stroke=\"#262335\" stroke-width=\"3.5\"></path><path d=\"M31 52 C38 38 82 36 89 52\" fill=\"none\" stroke=\"#262335\" stroke-width=\"3.5\" stroke-linecap=\"round\"></path><circle cx=\"47\" cy=\"63\" r=\"9.5\" fill=\"none\" stroke=\"#262335\" stroke-width=\"3.5\"></circle><circle cx=\"73\" cy=\"63\" r=\"9.5\" fill=\"none\" stroke=\"#262335\" stroke-width=\"3.5\"></circle><path d=\"M56 62 L64 62\" stroke=\"#262335\" stroke-width=\"3.5\" stroke-linecap=\"round\"></path><circle cx=\"47\" cy=\"64\" r=\"2.8\" fill=\"#262335\"></circle><circle cx=\"73\" cy=\"64\" r=\"2.8\" fill=\"#262335\"></circle><path d=\"M52 82 Q60 87 68 82\" fill=\"none\" stroke=\"#262335\" stroke-width=\"3.5\" stroke-linecap=\"round\"></path>",
  "name": "The Librarian",
  "line": "Research-led, precise, cites evidence.",
  "color": "#3D63F0"
 },
 "spark": {
  "bg": "#FFD3CC",
  "inner": "<path d=\"M28 54 L34 26 L44 42 L52 18 L60 38 L70 16 L76 38 L88 24 L92 54 Z\" fill=\"#262335\" stroke=\"#262335\" stroke-width=\"3\" stroke-linejoin=\"round\"></path><path d=\"M60 34 C80 33 93 46 92 64 C91 84 78 97 60 97 C42 97 29 84 29 64 C30 46 42 35 60 34 Z\" fill=\"#FFF6E8\" stroke=\"#262335\" stroke-width=\"3.5\"></path><path d=\"M40 55 L53 51\" stroke=\"#262335\" stroke-width=\"3.5\" stroke-linecap=\"round\"></path><path d=\"M67 52 L80 57\" stroke=\"#262335\" stroke-width=\"3.5\" stroke-linecap=\"round\"></path><circle cx=\"47\" cy=\"64\" r=\"3.4\" fill=\"#262335\"></circle><circle cx=\"73\" cy=\"64\" r=\"3.4\" fill=\"#262335\"></circle><path d=\"M48 82 Q62 86 74 76\" fill=\"none\" stroke=\"#262335\" stroke-width=\"3.5\" stroke-linecap=\"round\"></path>",
  "name": "The Spark",
  "line": "Bold takes, challenges the default view.",
  "color": "#E8473B"
 },
 "storyteller": {
  "bg": "#FBD1E6",
  "inner": "<path d=\"M60 34 C80 33 93 46 92 64 C91 84 78 97 60 97 C42 97 29 84 29 64 C30 46 42 35 60 34 Z\" fill=\"#FFF6E8\" stroke=\"#262335\" stroke-width=\"3.5\"></path><path d=\"M28 60 C26 40 40 28 60 28 C80 28 94 40 92 60 C86 50 80 44 72 46 C66 38 54 38 48 46 C40 44 32 50 28 60 Z\" fill=\"#262335\"></path><circle cx=\"47\" cy=\"64\" r=\"6\" fill=\"#FFFFFF\" stroke=\"#262335\" stroke-width=\"3\"></circle><circle cx=\"73\" cy=\"64\" r=\"6\" fill=\"#FFFFFF\" stroke=\"#262335\" stroke-width=\"3\"></circle><circle cx=\"48\" cy=\"65\" r=\"2.6\" fill=\"#262335\"></circle><circle cx=\"74\" cy=\"65\" r=\"2.6\" fill=\"#262335\"></circle><ellipse cx=\"60\" cy=\"83\" rx=\"5.5\" ry=\"6.5\" fill=\"#E85BA6\" stroke=\"#262335\" stroke-width=\"3\"></ellipse>",
  "name": "The Storyteller",
  "line": "Personal stories, lessons from experience.",
  "color": "#E85BA6"
 },
 "coach": {
  "bg": "#FFE9A8",
  "inner": "<path d=\"M60 34 C80 33 93 46 92 64 C91 84 78 97 60 97 C42 97 29 84 29 64 C30 46 42 35 60 34 Z\" fill=\"#FFF6E8\" stroke=\"#262335\" stroke-width=\"3.5\"></path><path d=\"M28 54 C30 30 90 30 92 54 Z\" fill=\"#F4B71E\" stroke=\"#262335\" stroke-width=\"3.5\" stroke-linejoin=\"round\"></path><path d=\"M84 52 L106 56\" stroke=\"#262335\" stroke-width=\"5\" stroke-linecap=\"round\"></path><path d=\"M42 64 L52 64\" stroke=\"#262335\" stroke-width=\"4\" stroke-linecap=\"round\"></path><path d=\"M68 64 L78 64\" stroke=\"#262335\" stroke-width=\"4\" stroke-linecap=\"round\"></path><path d=\"M46 77 Q60 92 74 77 Z\" fill=\"#FFFFFF\" stroke=\"#262335\" stroke-width=\"3.5\" stroke-linejoin=\"round\"></path>",
  "name": "The Coach",
  "line": "Practical how-tos and frameworks.",
  "color": "#F4B71E"
 },
 "host": {
  "bg": "#C4F0DA",
  "inner": "<path d=\"M60 34 C80 33 93 46 92 64 C91 84 78 97 60 97 C42 97 29 84 29 64 C30 46 42 35 60 34 Z\" fill=\"#FFF6E8\" stroke=\"#262335\" stroke-width=\"3.5\"></path><path d=\"M32 50 C40 30 70 28 88 46 C76 42 62 44 52 38 C46 44 38 46 32 50 Z\" fill=\"#262335\"></path><path d=\"M41 64 Q47 58 53 64\" fill=\"none\" stroke=\"#262335\" stroke-width=\"3.5\" stroke-linecap=\"round\"></path><circle cx=\"73\" cy=\"63\" r=\"3.4\" fill=\"#262335\"></circle><circle cx=\"40\" cy=\"76\" r=\"6\" fill=\"#FFB3C8\"></circle><circle cx=\"80\" cy=\"76\" r=\"6\" fill=\"#FFB3C8\"></circle><path d=\"M46 75 Q60 96 74 75 Z\" fill=\"#E8473B\" stroke=\"#262335\" stroke-width=\"3.5\" stroke-linejoin=\"round\"></path>",
  "name": "The Host",
  "line": "Starts conversations, invites people in.",
  "color": "#2FB57C"
 },
 "curator": {
  "bg": "#DCD1FF",
  "inner": "<path d=\"M60 34 C80 33 93 46 92 64 C91 84 78 97 60 97 C42 97 29 84 29 64 C30 46 42 35 60 34 Z\" fill=\"#FFF6E8\" stroke=\"#262335\" stroke-width=\"3.5\"></path><path d=\"M30 48 C36 26 82 22 92 42 C80 50 50 50 30 48 Z\" fill=\"#8C6CF0\" stroke=\"#262335\" stroke-width=\"3.5\" stroke-linejoin=\"round\"></path><path d=\"M62 24 L64 16\" stroke=\"#262335\" stroke-width=\"4\" stroke-linecap=\"round\"></path><circle cx=\"47\" cy=\"65\" r=\"3.4\" fill=\"#262335\"></circle><circle cx=\"73\" cy=\"65\" r=\"10\" fill=\"#FFFFFF\" stroke=\"#262335\" stroke-width=\"3.5\"></circle><circle cx=\"73\" cy=\"65\" r=\"3\" fill=\"#262335\"></circle><path d=\"M52 83 Q60 86 68 83\" fill=\"none\" stroke=\"#262335\" stroke-width=\"3.5\" stroke-linecap=\"round\"></path>",
  "name": "The Curator",
  "line": "Points to the best of what others made.",
  "color": "#8C6CF0"
 }
};
  const PIP = "<svg width=\"100\" height=\"104\" viewBox=\"0 -4 100 104\" aria-hidden=\"true\"><g class=\"bob\"><path d=\"M50 22 L50 14 L43 10 L55 4\" fill=\"none\" stroke=\"#262335\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path><circle cx=\"55\" cy=\"4\" r=\"5\" fill=\"#EDE9FF\" stroke=\"#262335\" stroke-width=\"3\"></circle><path d=\"M50 22 C73 22 88 38 88 60 C88 82 72 96 50 96 C28 96 12 82 12 60 C12 38 27 22 50 22 Z\" fill=\"#FF6B3D\" stroke=\"#262335\" stroke-width=\"3.5\"></path><circle cx=\"37\" cy=\"56\" r=\"9\" fill=\"#FFFFFF\" stroke=\"#262335\" stroke-width=\"3\"></circle><circle cx=\"63\" cy=\"56\" r=\"9\" fill=\"#FFFFFF\" stroke=\"#262335\" stroke-width=\"3\"></circle><circle cx=\"39\" cy=\"58\" r=\"4\" fill=\"#262335\"></circle><circle cx=\"65\" cy=\"58\" r=\"4\" fill=\"#262335\"></circle><circle cx=\"24\" cy=\"71\" r=\"5\" fill=\"#FFB3C8\"></circle><circle cx=\"76\" cy=\"71\" r=\"5\" fill=\"#FFB3C8\"></circle><path d=\"M36 76 L42 76 L46 70 L51 84 L55 74 L64 76\" fill=\"none\" stroke=\"#262335\" stroke-width=\"3.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path></g></svg>";
  function face(key, size = 96, cls = 'bob', draw = false) {
    const f = FACES[key] || FACES.librarian;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 120 120" role="img" aria-label="' + f.name + ' doodle face"><g class="' + cls + (draw ? ' draw' : '') + '"><circle cx="60" cy="60" r="56" fill="' + f.bg + '"></circle>' + f.inner + '</g></svg>';
  }
  function pip(size = 40, label) {
    return PIP.replace('width="100" height="104"', 'width="' + size + '" height="' + Math.round(size * 1.04) + '"')
      .replace('aria-hidden="true"', label ? 'role="img" aria-label="' + label + '"' : 'aria-hidden="true"');
  }
  function hydrate(root = document) {
    root.querySelectorAll('[data-pip]').forEach((el) => { el.innerHTML = pip(Number(el.dataset.pip) || 40, el.dataset.label); });
    root.querySelectorAll('[data-face]').forEach((el) => { el.innerHTML = face(el.dataset.face, Number(el.dataset.size) || 96, el.dataset.cls || 'bob', el.dataset.draw === '1'); });
  }
  window.PulseArt = { FACES, face, pip, hydrate };
  if (document.readyState !== 'loading') hydrate(); else document.addEventListener('DOMContentLoaded', () => hydrate());
})();
