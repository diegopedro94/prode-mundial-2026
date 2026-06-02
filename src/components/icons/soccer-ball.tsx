type Props = React.SVGProps<SVGSVGElement>;

/**
 * Hand-rolled hexagon-tiled soccer ball — replaces the "26" monogram and works
 * as a recognizable brand mark at any size.
 */
export function SoccerBall(props: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <circle cx="16" cy="16" r="14" fill="currentColor" />
      <path
        d="M16 8.5l4.8 3.5-1.84 5.7h-5.92l-1.84-5.7L16 8.5Z"
        fill="white"
        fillOpacity="0.95"
      />
      <path
        d="M9.4 14.2l2.7-2 1.8 5.6-3.65 2.65L7 17.85l2.4-3.65ZM22.6 14.2L25 17.85l-3.25 2.6-3.65-2.65 1.8-5.6 2.7 2ZM12 22l1.84-2.85h4.32L20 22l-2 3.5h-4L12 22Z"
        fill="white"
        fillOpacity="0.95"
      />
    </svg>
  );
}
