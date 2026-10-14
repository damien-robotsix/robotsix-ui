# Shared Dashboard Utilities

This library ships a set of framework-free CSS utilities for building consistent dashboard layouts across RobotSix deployed UIs. All utilities are prefixed `.rsu-` and use the shared design tokens.

## Page Layout

Use `.rsu-page` to create a centered, padded content column for dashboard pages mounted under AppShell. Combine with `.rsu-page-header` / `.rsu-page-title` for the standard heading row and `.rsu-page-grid` for a responsive card grid.

### Example

```html
<div class="rsu-page">
  <div class="rsu-page-header">
    <h1 class="rsu-page-title">Dashboard</h1>
    <button>Export</button>
  </div>

  <div class="rsu-page-grid">
    <div class="rsu-card">Card 1</div>
    <div class="rsu-card">Card 2</div>
    <div class="rsu-card">Card 3</div>
  </div>
</div>
```

- `.rsu-page` — max-width container with centered padding; use as the root of your page body.
- `.rsu-page-header` — flex row for title + actions; wraps on small screens.
- `.rsu-page-title` — heading text with standard font size and weight.
- `.rsu-page-grid` — responsive card grid (auto-fill, minimum column width 16rem).

## Data Tables

Apply `.rsu-table` to a `<table>` element to style dashboard data grids with header highlighting and row hover states.

### Example

```html
<table class="rsu-table">
  <thead>
    <tr>
      <th>Name</th>
      <th>Status</th>
      <th>Value</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Item A</td>
      <td>Active</td>
      <td>$1,234</td>
    </tr>
    <tr>
      <td>Item B</td>
      <td>Inactive</td>
      <td>$567</td>
    </tr>
  </tbody>
</table>
```

Header cells (`<th>`) receive a secondary background color and secondary text color. Body rows highlight on hover.

## Compact Lists

Use `.rsu-list` + `.rsu-list-item` for vertical stacks of bordered rows — ideal for compact data lists like calendar day items.

### Example

```html
<ul class="rsu-list">
  <li class="rsu-list-item">
    <span>Monday, Oct 7</span>
    <span class="rsu-badge">3 events</span>
  </li>
  <li class="rsu-list-item">
    <span>Tuesday, Oct 8</span>
    <span class="rsu-badge">1 event</span>
  </li>
  <li class="rsu-list-item">
    <span>Wednesday, Oct 9</span>
    <span>No events</span>
  </li>
</ul>
```

- `.rsu-list` — flex column container, resets list margins and bullets.
- `.rsu-list-item` — individual bordered row with flex layout for horizontal space-between alignment.

## Form Layouts

### Vertical Form

Stack `.rsu-field` elements vertically for a standard form layout. Use `.rsu-field-label` for field labels and `.rsu-form-actions` for a button row.

```html
<form class="rsu-form">
  <div class="rsu-field">
    <label class="rsu-field-label">Email</label>
    <input type="email" />
  </div>
  <div class="rsu-field">
    <label class="rsu-field-label">Message</label>
    <textarea></textarea>
  </div>
  <div class="rsu-form-actions">
    <button type="submit">Send</button>
    <button type="reset">Clear</button>
  </div>
</form>
```

### Inline Filter Bar

Add the `.rsu-form--inline` modifier to `.rsu-form` for a horizontal layout — ideal for filter bars and search panels.

```html
<form class="rsu-form rsu-form--inline">
  <div class="rsu-field">
    <label class="rsu-field-label">Status</label>
    <select>
      <option>All</option>
      <option>Active</option>
      <option>Inactive</option>
    </select>
  </div>
  <div class="rsu-field">
    <label class="rsu-field-label">Date Range</label>
    <input type="date" />
  </div>
  <div class="rsu-form-actions">
    <button type="submit">Filter</button>
    <button type="reset">Reset</button>
  </div>
</form>
```

Fields wrap on small screens; all elements align to the bottom baseline.

## Design Tokens

All utilities use the shared design tokens from `tokens.css` (spacing, colors, fonts, etc.). To customize spacing, colors, or other properties, override the design tokens in your host app:

```css
:root {
  --rsu-space-lg: 2rem; /* override the large spacing token */
  --rsu-color-bg-secondary: #f5f5f5; /* override secondary background */
}
```

See [Consuming robotsix-ui Styles](./consumption.md) for token customization details.
