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
          <feFuncR type="table" tableValues="0.180 0.584 0.867 1.000" />
          <feFuncG type="table" tableValues="0.027 0.133 0.290 0.776" />
          <feFuncB type="table" tableValues="0.067 0.235 0.408 0.812" />
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
          <feFuncR type="table" tableValues="0.051 0.137 0.247 0.369 0.788" />
          <feFuncG type="table" tableValues="0.090 0.251 0.478 0.612 0.937" />
          <feFuncB type="table" tableValues="0.067 0.165 0.275 0.376 0.761" />
        </feComponentTransfer>
      </filter>
      <filter id="tint-season" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="linear" slope="1.62" intercept="-0.58" />
          <feFuncG type="linear" slope="1.62" intercept="-0.58" />
          <feFuncB type="linear" slope="1.62" intercept="-0.58" />
        </feComponentTransfer>
        <feComponentTransfer>
          <feFuncR type="table" tableValues="0.071 0.282 0.541 0.875" />
          <feFuncG type="table" tableValues="0.106 0.365 0.639 0.914" />
          <feFuncB type="table" tableValues="0.169 0.514 0.804 0.980" />
        </feComponentTransfer>
      </filter>
      </defs>
    </svg>
  )
}
