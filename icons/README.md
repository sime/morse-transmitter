# Icons
There are two logo icons: logo and logo-alt.

1. Favicon is the optimized svg
2. App manifest gets 48, 144, and 512 rendered PNGs
3. App manifest also gets 144 and 512 maskable icons which have no border radius and are scaled to fit inside the maskable safe area.

The icons used to label the settings have mostly been edited to remove stroke and fill colors which are added back with CSS.  Most of the icons are simply fill: none; and stroke: #A0A0A0; when non active and fill: #f5df4d; stroke: #f5df4d; when active.  The exception is the screen flash.  The lightning is clipped out of the background when active but fill: #a0a0a0; when non active.  Hence the --lightning-color variable.  currentColor is an alternative but might be more confusing.