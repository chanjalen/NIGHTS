'use client';

import { useEffect, useState } from 'react';

export default function DecorativeBorder() {
  const [visible, setVisible] = useState<boolean[]>([]);

  useEffect(() => {
    setVisible(Array.from({ length: 80 }, () => Math.random() < 0.3));
  }, []);

  return (
    <div className="decorative-border" aria-hidden="true">
      {visible.map((show, i) =>
        show ? <span key={i} className="decorative-square" /> : null
      )}
    </div>
  );
}
