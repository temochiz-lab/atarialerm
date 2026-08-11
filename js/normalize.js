export function normalizeGuides(guides) {
  if (guides.length < 2) return [];
  const origin = guides[0];
  const reference = guides[1];
  const dx = reference.x - origin.x;
  const dy = reference.y - origin.y;
  const scale = Math.hypot(dx, dy) || 1;
  const cos = dx / scale;
  const sin = dy / scale;

  return guides.map((guide) => {
    const tx = guide.x - origin.x;
    const ty = guide.y - origin.y;
    return {
      id: guide.id,
      x: (tx * cos + ty * sin) / scale,
      y: (-tx * sin + ty * cos) / scale,
      status: guide.status
    };
  });
}
