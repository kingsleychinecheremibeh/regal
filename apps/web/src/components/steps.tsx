export function Steps({ items }: { items: string[] }) {
  return (
    <div className="grid g3">
      {items.map((text, index) => (
        <div className="card tile" key={text}>
          <div className="stepn">{index + 1}</div>
          <h3>{text}</h3>
        </div>
      ))}
    </div>
  );
}
