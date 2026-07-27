/**
 * Renders remote peer cursors on the current page (room page or injected page).
 */
export default function CursorOverlay({ cursors = {} }) {
  return (
    <>
      {Object.entries(cursors).map(([id, c]) => {
        if (!c || c.x == null) return null
        return (
          <div
            key={id}
            className="synerdio-cursor"
            style={{ left: c.x, top: c.y }}
            data-name={c.name || 'Peer'}
          />
        )
      })}
    </>
  )
}
