# Font Files for PDF Generation

## Available Fonts

### Playfair Display (Serif - for headings)
- **File**: `PlayfairDisplay.ttf`
- **Type**: Variable font with all weights (400-900)
- **Weights available**: Regular (400), Medium (500), SemiBold (600), Bold (700), ExtraBold (800), Black (900)
- **Italic version**: `PlayfairDisplay-Italic.ttf`

### Work Sans (Sans-serif - for body text)
- **File**: `WorkSans.ttf`
- **Type**: Variable font with all weights (100-900)
- **Weights available**: Thin (100), ExtraLight (200), Light (300), Regular (400), Medium (500), SemiBold (600), Bold (700), ExtraBold (800), Black (900)
- **Italic version**: `WorkSans-Italic.ttf`

## PDFKit Usage

```javascript
// Register fonts
doc.registerFont('Playfair', path.join(__dirname, 'assets/fonts/PlayfairDisplay.ttf'));
doc.registerFont('WorkSans', path.join(__dirname, 'assets/fonts/WorkSans.ttf'));

// Use fonts (variable fonts support weight parameter)
doc.font('Playfair', { weight: 700 }).fontSize(24).text('Bold Heading');
doc.font('WorkSans', { weight: 400 }).fontSize(12).text('Body text');
```

## Notes
- All fonts are **variable fonts** - they contain all weights in a single file
- All fonts are verified TrueType Font (TTF) format
- All fonts are open source (OFL license)
- Source: Google Fonts official repository
