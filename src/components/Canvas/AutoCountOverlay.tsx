import { Circle, Group, Label, Rect, Tag, Text } from 'react-konva';
import type { Size } from '@/types';
import { useAutoCountStore } from '@/store';
import { normaliseBox } from '@/utils/symbolMatch';

const TEMPLATE_COLOR = '#f97316';
const ACCEPTED_COLOR = '#4ade80';
const REJECTED_COLOR = '#f87171';

interface AutoCountOverlayProps {
  zoom: number;
  /** Full-resolution size of the current page, used to clamp the marquee. */
  pageSize: Size;
}

/** Draws the symbol template, the marquee, and every hit awaiting review. */
export function AutoCountOverlay({ zoom, pageSize }: AutoCountOverlayProps) {
  const stage = useAutoCountStore((s) => s.stage);
  const templateBox = useAutoCountStore((s) => s.templateBox);
  const matches = useAutoCountStore((s) => s.matches);
  const accepted = useAutoCountStore((s) => s.accepted);
  const toggleMatch = useAutoCountStore((s) => s.toggleMatch);
  // Subscribed rather than read on demand so the marquee follows the pointer.
  const dragStart = useAutoCountStore((s) => s.dragStart);
  const dragCurrent = useAutoCountStore((s) => s.dragCurrent);

  if (stage === 'idle') return null;

  const dragBox =
    dragStart && dragCurrent
      ? normaliseBox(dragStart, dragCurrent, pageSize.width, pageSize.height)
      : null;

  const markerRadius = templateBox
    ? Math.max(Math.min(templateBox.width, templateBox.height) / 2, 6 / zoom)
    : 10 / zoom;

  return (
    <Group>
      {dragBox && dragBox.width > 0 && (
        <Rect
          x={dragBox.x}
          y={dragBox.y}
          width={dragBox.width}
          height={dragBox.height}
          stroke={TEMPLATE_COLOR}
          strokeWidth={2}
          strokeScaleEnabled={false}
          dash={[6 / zoom, 4 / zoom]}
          fill="rgba(249, 115, 22, 0.12)"
          listening={false}
        />
      )}

      {templateBox && !dragBox && (
        <Group listening={false}>
          <Rect
            x={templateBox.x}
            y={templateBox.y}
            width={templateBox.width}
            height={templateBox.height}
            stroke={TEMPLATE_COLOR}
            strokeWidth={2}
            strokeScaleEnabled={false}
            listening={false}
          />
          <Label
            x={templateBox.x}
            y={templateBox.y}
            scaleX={1 / zoom}
            scaleY={1 / zoom}
            listening={false}
          >
            <Tag fill={TEMPLATE_COLOR} cornerRadius={3} />
            <Text text="สัญลักษณ์ต้นแบบ" fontSize={11} padding={4} fill="#0b1220" />
          </Label>
        </Group>
      )}

      {matches.map((match, index) => {
        const isAccepted = accepted[index];
        return (
          <Circle
            key={`${match.x}-${match.y}-${index}`}
            x={match.x}
            y={match.y}
            radius={markerRadius}
            stroke={isAccepted ? ACCEPTED_COLOR : REJECTED_COLOR}
            strokeWidth={2}
            strokeScaleEnabled={false}
            fill={
              isAccepted ? 'rgba(74, 222, 128, 0.22)' : 'rgba(248, 113, 113, 0.12)'
            }
            dash={isAccepted ? undefined : [4 / zoom, 3 / zoom]}
            hitStrokeWidth={Math.max(markerRadius, 10 / zoom)}
            perfectDrawEnabled={false}
            onClick={(e) => {
              e.cancelBubble = true;
              toggleMatch(index);
            }}
            onTap={() => toggleMatch(index)}
            onMouseEnter={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'pointer';
            }}
            onMouseLeave={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = '';
            }}
          />
        );
      })}
    </Group>
  );
}
