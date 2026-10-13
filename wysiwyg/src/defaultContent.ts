export const DEFAULT_LML = `host(align: leading, justify: start) {
    page(md:overview, w: 1fr, h: 1fr, pad: 40) {
        v(gap: 24) {
        md:header

            h(2fr, 1fr, gap: 20, align: leading) {
                md:analysis

                v(gap: 16) {
                    md:insight

                    h(1fr, 1fr, gap: 12) {
                        md:cagr
                        md:margin
                    }

                    md:commentary
                }
            }
        }
    }
}`;

export const DEFAULT_MD = `# overview
## Page description
Market overview screen layout and intended behavior.

# header
## Market Overview
FY2026 Market Analysis

# analysis
## Market Growth
...

# insight
## Key Insight
...

# cagr
## CAGR
**18.4%**

# margin
## Margin
**31%**

# commentary
## Implication
...`;
