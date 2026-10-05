CSG product-specific landing pages — Whop-aligned review package

Baseline
- Deployed Render service: csg-next
- Repository: https://github.com/sinfronterasai/csg-next
- Branch: main
- Live deployment commit: 43a6f88176dafb45ae2677d3546829d0519f3c1c
- Deployment: dep-davc43ivcj2c73836jp0
- Active provider evidence: Render API reported the deployment as live on October 1, 2026; origin/main contains the Whop fulfillment merge.

Landing-page candidate
- Branch: feature/product-specific-report-landing-pages-whop
- Base: origin/main at 43a6f88176dafb45ae2677d3546829d0519f3c1c
- No deployment or merge performed.

Provider mappings
- Premium Natal Report: Whop plan_oazEpfS5z5Gud / offer premium_natal_report / report-natalpremium / $39
- Yearly Transit Forecast: Whop plan_yspM7Upl5CsPM / offer yearly_transit_forecast / report-transit / $49
- Vocation & Wealth Map: Whop plan_H6o8FSjDvpw7Y / offer vocation_wealth_map / report-vocation / $55

Screenshot files
- premium-natal-whop-desktop.png
- premium-natal-whop-mobile.png
- yearly-transit-whop-desktop.png
- yearly-transit-whop-mobile.png
- vocation-wealth-whop-desktop.png
- vocation-wealth-whop-mobile.png

Verification boundaries
- Browser verification stopped before payment.
- No Whop account login, payment entry, real charge, webhook, or paid report generation was performed.
- Whop public checkout pages exposed the plan IDs and numeric price tokens 3900, 4900, and 5500 in the loaded provider HTML. The visible checkout body was empty in the browser harness, so provider rendering was not treated as a full visual checkout verification.
