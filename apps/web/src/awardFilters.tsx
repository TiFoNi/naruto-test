export default function AwardFilters() {
  return (
    <svg className="award-filters" aria-hidden focusable="false">
      <defs>
      <filter id="tint-bronze" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="linear" slope="1.62" intercept="-0.58" />
          <feFuncG type="linear" slope="1.62" intercept="-0.58" />
          <feFuncB type="linear" slope="1.62" intercept="-0.58" />
        </feComponentTransfer>
        <feComponentTransfer>
          <feFuncR type="table" tableValues="0.165 0.541 0.816 1.000" />
          <feFuncG type="table" tableValues="0.078 0.302 0.541 0.863" />
          <feFuncB type="table" tableValues="0.027 0.118 0.267 0.675" />
        </feComponentTransfer>
      </filter>
      <filter id="tint-silver" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="linear" slope="1.62" intercept="-0.58" />
          <feFuncG type="linear" slope="1.62" intercept="-0.58" />
          <feFuncB type="linear" slope="1.62" intercept="-0.58" />
        </feComponentTransfer>
        <feComponentTransfer>
          <feFuncR type="table" tableValues="0.122 0.420 0.718 1.000" />
          <feFuncG type="table" tableValues="0.157 0.471 0.765 1.000" />
          <feFuncB type="table" tableValues="0.204 0.537 0.827 1.000" />
        </feComponentTransfer>
      </filter>
      <filter id="tint-gold" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="linear" slope="1.62" intercept="-0.58" />
          <feFuncG type="linear" slope="1.62" intercept="-0.58" />
          <feFuncB type="linear" slope="1.62" intercept="-0.58" />
        </feComponentTransfer>
        <feComponentTransfer>
          <feFuncR type="table" tableValues="0.180 0.604 0.878 1.000" />
          <feFuncG type="table" tableValues="0.125 0.435 0.698 0.941" />
          <feFuncB type="table" tableValues="0.020 0.071 0.243 0.761" />
        </feComponentTransfer>
      </filter>
      <filter id="tint-legend" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="linear" slope="1.62" intercept="-0.58" />
          <feFuncG type="linear" slope="1.62" intercept="-0.58" />
          <feFuncB type="linear" slope="1.62" intercept="-0.58" />
        </feComponentTransfer>
        <feComponentTransfer>
          <feFuncR type="table" tableValues="0.114 0.353 0.608 0.902" />
          <feFuncG type="table" tableValues="0.082 0.267 0.525 0.867" />
          <feFuncB type="table" tableValues="0.251 0.659 0.933 1.000" />
        </feComponentTransfer>
      </filter>
      <filter id="tint-mythic" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="linear" slope="1.62" intercept="-0.58" />
          <feFuncG type="linear" slope="1.62" intercept="-0.58" />
          <feFuncB type="linear" slope="1.62" intercept="-0.58" />
        </feComponentTransfer>
        <feComponentTransfer>
          <feFuncR type="table" tableValues="0.208 0.612 0.878 1.000" />
          <feFuncG type="table" tableValues="0.031 0.184 0.384 0.784" />
          <feFuncB type="table" tableValues="0.122 0.373 0.612 0.871" />
        </feComponentTransfer>
      </filter>
      <filter id="tint-secret" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="linear" slope="1.62" intercept="-0.58" />
          <feFuncG type="linear" slope="1.62" intercept="-0.58" />
          <feFuncB type="linear" slope="1.62" intercept="-0.58" />
        </feComponentTransfer>
        <feComponentTransfer>
          <feFuncR type="table" tableValues="0.027 0.122 0.275 0.784" />
          <feFuncG type="table" tableValues="0.137 0.478 0.725 0.945" />
          <feFuncB type="table" tableValues="0.102 0.345 0.541 0.871" />
        </feComponentTransfer>
      </filter>
      </defs>
    </svg>
  )
}
