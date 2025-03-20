import { PDFDocument, rgb, StandardFonts, PageSizes, degrees } from 'pdf-lib';
import { DocumentAnalysis } from '@/lib/db/schema';

/**
 * Analysis report generator for creating PDF reports from document analysis results
 */
export class AnalysisReportGenerator {
  private analysis: any;
  private documentName: string;
  private generatedDate: Date;
  private pdfDoc: PDFDocument | null = null;
  
  constructor(analysis: any, documentName: string) {
    this.analysis = analysis;
    this.documentName = documentName;
    this.generatedDate = new Date();
  }
  
  /**
   * Generate a PDF report from the analysis data
   * @returns Buffer containing the PDF data
   */
  async generatePDF(): Promise<Uint8Array> {
    // Create a new PDF document
    this.pdfDoc = await PDFDocument.create();
    
    // Add metadata to the document
    this.pdfDoc.setTitle(`CV Analysis Report - ${this.documentName}`);
    this.pdfDoc.setAuthor('CV Optimizer');
    this.pdfDoc.setSubject('Document Analysis Report');
    this.pdfDoc.setKeywords(['CV', 'analysis', 'report', 'document']);
    this.pdfDoc.setCreationDate(this.generatedDate);
    this.pdfDoc.setModificationDate(this.generatedDate);
    
    // Add pages to the document
    await this.addCoverPage();
    await this.addSummaryPage();
    await this.addContentAnalysisPage();
    await this.addSentimentAnalysisPage();
    await this.addKeyInformationPage();
    
    // Save the document
    return await this.pdfDoc.save();
  }
  
  /**
   * Add a cover page to the report
   */
  private async addCoverPage() {
    const page = this.pdfDoc!.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    
    // Load fonts
    const helveticaBold = await this.pdfDoc!.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await this.pdfDoc!.embedFont(StandardFonts.Helvetica);
    
    // Brand colors
    const brandColor = rgb(0.05, 0.05, 0.05); // #050505
    const accentColor = rgb(0.7, 0.57, 0.42); // #B4916C
    const textColor = rgb(0.98, 0.96, 0.93); // #F9F6EE
    
    // Draw background
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: brandColor,
    });
    
    // Draw accent rectangle
    page.drawRectangle({
      x: 50,
      y: 50,
      width: width - 100,
      height: height - 100,
      borderColor: accentColor,
      borderWidth: 2,
      opacity: 0.8,
    });
    
    // Add logo (placeholder rectangle for now)
    page.drawRectangle({
      x: width / 2 - 50,
      y: height - 150,
      width: 100,
      height: 40,
      color: accentColor,
    });
    
    // Add title
    page.drawText('DOCUMENT ANALYSIS REPORT', {
      x: width / 2 - 180,
      y: height / 2 + 100,
      size: 24,
      font: helveticaBold,
      color: textColor,
    });
    
    // Add document name
    page.drawText(this.documentName, {
      x: width / 2 - helveticaBold.widthOfTextAtSize(this.documentName, 18) / 2,
      y: height / 2 + 50,
      size: 18,
      font: helveticaBold,
      color: accentColor,
    });
    
    // Add date
    const dateString = this.generatedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    page.drawText(`Generated on ${dateString}`, {
      x: width / 2 - helvetica.widthOfTextAtSize(`Generated on ${dateString}`, 12) / 2,
      y: height / 2,
      size: 12,
      font: helvetica,
      color: textColor,
    });
    
    // Add overall score
    const score = this.analysis.summary?.overallScore || 0;
    const scoreText = `Overall Score: ${score}/100`;
    page.drawText(scoreText, {
      x: width / 2 - helveticaBold.widthOfTextAtSize(scoreText, 18) / 2,
      y: height / 2 - 60,
      size: 18,
      font: helveticaBold,
      color: accentColor,
    });
    
    // Add footer
    page.drawText('CV Optimizer - AI-Powered Document Analysis', {
      x: width / 2 - helvetica.widthOfTextAtSize('CV Optimizer - AI-Powered Document Analysis', 10) / 2,
      y: 50,
      size: 10,
      font: helvetica,
      color: textColor,
      opacity: 0.7,
    });
  }
  
  /**
   * Add a summary page to the report
   */
  private async addSummaryPage() {
    const page = this.pdfDoc!.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    
    // Load fonts
    const helveticaBold = await this.pdfDoc!.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await this.pdfDoc!.embedFont(StandardFonts.Helvetica);
    
    // Colors
    const titleColor = rgb(0.05, 0.05, 0.05); // #050505
    const accentColor = rgb(0.7, 0.57, 0.42); // #B4916C
    const textColor = rgb(0.2, 0.2, 0.2);
    
    // Add header
    this.drawHeader(page, 'Executive Summary', helveticaBold, titleColor);
    
    // Add summary section
    let y = height - 150;
    
    // Section: Key Highlights
    page.drawText('Key Highlights', {
      x: 60,
      y,
      size: 14,
      font: helveticaBold,
      color: accentColor,
    });
    
    y -= 30;
    
    // Draw key highlights
    const highlights = this.analysis.summary?.highlights || [];
    for (const highlight of highlights) {
      // Draw bullet point
      page.drawCircle({
        x: 65,
        y: y + 4,
        size: 3,
        color: accentColor,
      });
      
      // Wrap text if needed
      const wrappedText = this.wrapText(highlight, helvetica, 12, width - 160);
      for (const line of wrappedText) {
        page.drawText(line, {
          x: 75,
          y,
          size: 12,
          font: helvetica,
          color: textColor,
        });
        y -= 20;
      }
      
      y -= 5; // Additional spacing between items
    }
    
    y -= 20;
    
    // Section: Improvement Suggestions
    page.drawText('Improvement Suggestions', {
      x: 60,
      y,
      size: 14,
      font: helveticaBold,
      color: accentColor,
    });
    
    y -= 30;
    
    // Draw improvement suggestions
    const suggestions = this.analysis.summary?.suggestions || [];
    for (const suggestion of suggestions) {
      // Draw arrow bullet point (→)
      page.drawText('→', {
        x: 65,
        y,
        size: 12,
        font: helvetica,
        color: accentColor,
      });
      
      // Wrap text if needed
      const wrappedText = this.wrapText(suggestion, helvetica, 12, width - 160);
      for (const line of wrappedText) {
        page.drawText(line, {
          x: 75,
          y,
          size: 12,
          font: helvetica,
          color: textColor,
        });
        y -= 20;
      }
      
      y -= 5; // Additional spacing between items
    }
    
    // Add overall score visualization
    const score = this.analysis.summary?.overallScore || 0;
    this.drawScoreGauge(page, width - 150, height - 250, 100, score, helveticaBold);
    
    // Add page number
    this.drawPageNumber(page, 1);
  }
  
  /**
   * Add a content analysis page to the report
   */
  private async addContentAnalysisPage() {
    const page = this.pdfDoc!.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    
    // Load fonts
    const helveticaBold = await this.pdfDoc!.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await this.pdfDoc!.embedFont(StandardFonts.Helvetica);
    
    // Colors
    const titleColor = rgb(0.05, 0.05, 0.05); // #050505
    const accentColor = rgb(0.7, 0.57, 0.42); // #B4916C
    const textColor = rgb(0.2, 0.2, 0.2);
    
    // Add header
    this.drawHeader(page, 'Content Analysis', helveticaBold, titleColor);
    
    // Content distribution section
    page.drawText('Content Distribution', {
      x: 60,
      y: height - 150,
      size: 14,
      font: helveticaBold,
      color: accentColor,
    });
    
    // Draw simple bar chart for content distribution
    const contentDistribution = this.analysis.contentAnalysis?.contentDistribution || [];
    let y = height - 180;
    
    for (const item of contentDistribution) {
      // Label
      page.drawText(item.name, {
        x: 60,
        y,
        size: 11,
        font: helvetica,
        color: textColor,
      });
      
      // Value
      page.drawText(`${item.value}%`, {
        x: 350,
        y,
        size: 11,
        font: helveticaBold,
        color: textColor,
      });
      
      // Progress bar background
      page.drawRectangle({
        x: 60,
        y: y - 15,
        width: 220,
        height: 10,
        color: rgb(0.9, 0.9, 0.9),
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
        opacity: 0.5,
      });
      
      // Progress bar fill
      page.drawRectangle({
        x: 60,
        y: y - 15,
        width: (item.value / 100) * 220,
        height: 10,
        color: accentColor,
        opacity: 0.7 + (item.value / 100) * 0.3, // Higher values are more opaque
      });
      
      y -= 40;
    }
    
    // Top keywords section
    page.drawText('Top Keywords', {
      x: 60,
      y: y - 20,
      size: 14,
      font: helveticaBold,
      color: accentColor,
    });
    
    // Draw keyword table
    const topKeywords = this.analysis.contentAnalysis?.topKeywords || [];
    y -= 50;
    
    // Table header
    page.drawRectangle({
      x: 60,
      y: y + 25,
      width: 290,
      height: 25,
      color: rgb(0.95, 0.95, 0.95),
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
    });
    
    page.drawText('Keyword', {
      x: 70,
      y: y + 10,
      size: 12,
      font: helveticaBold,
      color: titleColor,
    });
    
    page.drawText('Relevance Score', {
      x: 250,
      y: y + 10,
      size: 12,
      font: helveticaBold,
      color: titleColor,
    });
    
    // Table rows
    for (let i = 0; i < Math.min(10, topKeywords.length); i++) {
      const keyword = topKeywords[i];
      y -= 25;
      
      // Alternating row background
      if (i % 2 === 0) {
        page.drawRectangle({
          x: 60,
          y: y + 5,
          width: 290,
          height: 25,
          color: rgb(0.98, 0.98, 0.98),
          borderColor: rgb(0.9, 0.9, 0.9),
          borderWidth: 1,
        });
      }
      
      page.drawText(keyword.text, {
        x: 70,
        y: y + 10,
        size: 11,
        font: helvetica,
        color: textColor,
      });
      
      // Draw mini bar for score
      page.drawRectangle({
        x: 250,
        y: y + 10,
        width: 80,
        height: 8,
        color: rgb(0.9, 0.9, 0.9),
        borderColor: rgb(0.85, 0.85, 0.85),
        borderWidth: 1,
        opacity: 0.5,
      });
      
      page.drawRectangle({
        x: 250,
        y: y + 10,
        width: (keyword.value / 10) * 80,
        height: 8,
        color: accentColor,
        opacity: 0.7,
      });
      
      // Draw score value
      page.drawText(keyword.value.toString(), {
        x: 340,
        y: y + 10,
        size: 11,
        font: helveticaBold,
        color: textColor,
      });
    }
    
    // Add page number
    this.drawPageNumber(page, 2);
  }
  
  /**
   * Add a sentiment analysis page to the report
   */
  private async addSentimentAnalysisPage() {
    const page = this.pdfDoc!.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    
    // Load fonts
    const helveticaBold = await this.pdfDoc!.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await this.pdfDoc!.embedFont(StandardFonts.Helvetica);
    
    // Colors
    const titleColor = rgb(0.05, 0.05, 0.05); // #050505
    const accentColor = rgb(0.7, 0.57, 0.42); // #B4916C
    const textColor = rgb(0.2, 0.2, 0.2);
    
    // Add header
    this.drawHeader(page, 'Sentiment Analysis', helveticaBold, titleColor);
    
    // Overall sentiment score
    const sentimentScore = this.analysis.sentimentAnalysis?.overallScore || 0;
    
    // Draw large gauge for overall sentiment
    this.drawScoreGauge(page, width / 2, height - 200, 120, sentimentScore * 100, helveticaBold);
    
    // Add sentiment description
    let sentimentDescription = 'Neutral';
    if (sentimentScore >= 0.8) {
      sentimentDescription = 'Very Positive';
    } else if (sentimentScore >= 0.6) {
      sentimentDescription = 'Positive';
    } else if (sentimentScore >= 0.4) {
      sentimentDescription = 'Slightly Positive';
    } else if (sentimentScore < 0.4 && sentimentScore >= 0.3) {
      sentimentDescription = 'Slightly Negative';
    } else if (sentimentScore < 0.3) {
      sentimentDescription = 'Negative';
    }
    
    page.drawText(`Overall Sentiment: ${sentimentDescription}`, {
      x: width / 2 - helveticaBold.widthOfTextAtSize(`Overall Sentiment: ${sentimentDescription}`, 14) / 2,
      y: height - 260,
      size: 14,
      font: helveticaBold,
      color: accentColor,
    });
    
    // Sentiment by section
    page.drawText('Sentiment by Section', {
      x: 60,
      y: height - 310,
      size: 14,
      font: helveticaBold,
      color: accentColor,
    });
    
    // Draw sentiment by section
    const sentimentBySection = this.analysis.sentimentAnalysis?.sentimentBySection || [];
    let y = height - 340;
    
    for (const item of sentimentBySection) {
      // Section name
      page.drawText(item.section, {
        x: 60,
        y,
        size: 11,
        font: helvetica,
        color: textColor,
      });
      
      // Score value
      page.drawText(item.score.toFixed(2), {
        x: 330,
        y,
        size: 11,
        font: helveticaBold,
        color: textColor,
      });
      
      // Progress bar background
      page.drawRectangle({
        x: 60,
        y: y - 15,
        width: 250,
        height: 10,
        color: rgb(0.9, 0.9, 0.9),
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
        opacity: 0.5,
      });
      
      // Progress bar fill
      page.drawRectangle({
        x: 60,
        y: y - 15,
        width: item.score * 250,
        height: 10,
        color: accentColor,
        opacity: 0.7 + item.score * 0.3, // Higher values are more opaque
      });
      
      y -= 40;
    }
    
    // Add sentiment explanation
    page.drawText('Sentiment Score Interpretation', {
      x: 60,
      y: y - 20,
      size: 14,
      font: helveticaBold,
      color: accentColor,
    });
    
    y -= 50;
    
    const explanationText = 
      'The sentiment score reflects the overall tone and language used in your document. ' +
      'For resumes and CVs, a high score indicates strong, confident, and achievement-focused language. ' +
      'Low scores may suggest vague descriptions, passive voice, or a lack of specific achievements.';
    
    const wrappedExplanation = this.wrapText(explanationText, helvetica, 11, width - 120);
    for (const line of wrappedExplanation) {
      page.drawText(line, {
        x: 60,
        y,
        size: 11,
        font: helvetica,
        color: textColor,
      });
      y -= 20;
    }
    
    // Add page number
    this.drawPageNumber(page, 3);
  }
  
  /**
   * Add a key information page to the report
   */
  private async addKeyInformationPage() {
    const page = this.pdfDoc!.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    
    // Load fonts
    const helveticaBold = await this.pdfDoc!.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await this.pdfDoc!.embedFont(StandardFonts.Helvetica);
    
    // Colors
    const titleColor = rgb(0.05, 0.05, 0.05); // #050505
    const accentColor = rgb(0.7, 0.57, 0.42); // #B4916C
    const textColor = rgb(0.2, 0.2, 0.2);
    
    // Add header
    this.drawHeader(page, 'Key Information', helveticaBold, titleColor);
    
    let y = height - 150;
    
    // Contact information section
    page.drawText('Contact Information', {
      x: 60,
      y,
      size: 14,
      font: helveticaBold,
      color: accentColor,
    });
    
    y -= 30;
    
    // Draw contact info table
    const contactInfo = this.analysis.keyInformation?.contactInfo || [];
    
    // Draw table border
    page.drawRectangle({
      x: 60,
      y: y,
      width: 350,
      height: 25 + (contactInfo.length * 25),
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
      color: rgb(0.98, 0.98, 0.98),
    });
    
    // Table header
    page.drawRectangle({
      x: 60,
      y: y,
      width: 350,
      height: 25,
      color: rgb(0.95, 0.95, 0.95),
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
    });
    
    page.drawText('Type', {
      x: 70,
      y: y - 15,
      size: 12,
      font: helveticaBold,
      color: titleColor,
    });
    
    page.drawText('Value', {
      x: 200,
      y: y - 15,
      size: 12,
      font: helveticaBold,
      color: titleColor,
    });
    
    // Table rows
    y -= 25;
    for (const item of contactInfo) {
      page.drawText(item.type, {
        x: 70,
        y: y - 15,
        size: 11,
        font: helvetica,
        color: textColor,
      });
      
      page.drawText(item.value, {
        x: 200,
        y: y - 15,
        size: 11,
        font: helvetica,
        color: textColor,
      });
      
      y -= 25;
    }
    
    y -= 30;
    
    // Key dates section
    page.drawText('Key Dates', {
      x: 60,
      y,
      size: 14,
      font: helveticaBold,
      color: accentColor,
    });
    
    y -= 30;
    
    // Draw key dates table
    const keyDates = this.analysis.keyInformation?.keyDates || [];
    
    if (keyDates.length > 0) {
      // Draw table border
      page.drawRectangle({
        x: 60,
        y: y,
        width: 350,
        height: 25 + (keyDates.length * 25),
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
        color: rgb(0.98, 0.98, 0.98),
      });
      
      // Table header
      page.drawRectangle({
        x: 60,
        y: y,
        width: 350,
        height: 25,
        color: rgb(0.95, 0.95, 0.95),
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
      });
      
      page.drawText('Description', {
        x: 70,
        y: y - 15,
        size: 12,
        font: helveticaBold,
        color: titleColor,
      });
      
      page.drawText('Date', {
        x: 260,
        y: y - 15,
        size: 12,
        font: helveticaBold,
        color: titleColor,
      });
      
      // Table rows
      y -= 25;
      for (const item of keyDates) {
        page.drawText(item.description, {
          x: 70,
          y: y - 15,
          size: 11,
          font: helvetica,
          color: textColor,
        });
        
        page.drawText(item.date, {
          x: 260,
          y: y - 15,
          size: 11,
          font: helvetica,
          color: textColor,
        });
        
        y -= 25;
      }
    } else {
      page.drawText('No key dates detected in the document.', {
        x: 70,
        y: y - 15,
        size: 11,
        font: helvetica,
        color: textColor,
      });
      y -= 25;
    }
    
    y -= 30;
    
    // Entities section
    page.drawText('Top Entities', {
      x: 60,
      y,
      size: 14,
      font: helveticaBold,
      color: accentColor,
    });
    
    y -= 30;
    
    // Draw entities table
    const entities = (this.analysis.keyInformation?.entities || [])
      .sort((a: any, b: any) => b.occurrences - a.occurrences)
      .slice(0, 10); // Show top 10 only
    
    if (entities.length > 0) {
      // Draw table border
      page.drawRectangle({
        x: 60,
        y: y,
        width: 450,
        height: 25 + (entities.length * 25),
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
        color: rgb(0.98, 0.98, 0.98),
      });
      
      // Table header
      page.drawRectangle({
        x: 60,
        y: y,
        width: 450,
        height: 25,
        color: rgb(0.95, 0.95, 0.95),
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
      });
      
      page.drawText('Type', {
        x: 70,
        y: y - 15,
        size: 12,
        font: helveticaBold,
        color: titleColor,
      });
      
      page.drawText('Name', {
        x: 160,
        y: y - 15,
        size: 12,
        font: helveticaBold,
        color: titleColor,
      });
      
      page.drawText('Occurrences', {
        x: 350,
        y: y - 15,
        size: 12,
        font: helveticaBold,
        color: titleColor,
      });
      
      // Table rows
      y -= 25;
      for (const entity of entities) {
        page.drawText(entity.type, {
          x: 70,
          y: y - 15,
          size: 11,
          font: helvetica,
          color: textColor,
        });
        
        page.drawText(entity.name, {
          x: 160,
          y: y - 15,
          size: 11,
          font: helvetica,
          color: textColor,
        });
        
        page.drawText(entity.occurrences.toString(), {
          x: 380,
          y: y - 15,
          size: 11,
          font: helvetica,
          color: textColor,
        });
        
        y -= 25;
      }
    } else {
      page.drawText('No significant entities detected in the document.', {
        x: 70,
        y: y - 15,
        size: 11,
        font: helvetica,
        color: textColor,
      });
    }
    
    // Add page number
    this.drawPageNumber(page, 4);
  }
  
  /**
   * Helper method to draw a page header
   */
  private async drawHeader(page: any, title: string, font: any, color: any) {
    const { width, height } = page.getSize();
    
    // Draw header background
    page.drawRectangle({
      x: 0,
      y: height - 90,
      width,
      height: 90,
      color: rgb(0.05, 0.05, 0.05), // #050505
    });
    
    // Draw header title
    page.drawText(title, {
      x: 60,
      y: height - 50,
      size: 18,
      font,
      color: rgb(0.98, 0.96, 0.93), // #F9F6EE
    });
    
    // Draw header line
    page.drawLine({
      start: { x: 0, y: height - 90 },
      end: { x: width, y: height - 90 },
      thickness: 2,
      color: rgb(0.7, 0.57, 0.42), // #B4916C
    });
  }
  
  /**
   * Helper method to draw a score gauge
   */
  private drawScoreGauge(page: any, x: number, y: number, size: number, score: number, font: any) {
    const scoreValue = score / 100;
    const accentColor = rgb(0.7, 0.57, 0.42); // #B4916C
    
    // Draw background circle
    page.drawCircle({
      x,
      y,
      size: size / 2,
      color: rgb(0.95, 0.95, 0.95),
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
    });
    
    // Draw score text
    page.drawText(`${Math.round(score)}`, {
      x: x - font.widthOfTextAtSize(`${Math.round(score)}`, 24) / 2,
      y: y - 5,
      size: 24,
      font,
      color: accentColor,
    });
    
    // Draw "out of 100" text
    page.drawText('out of 100', {
      x: x - font.widthOfTextAtSize('out of 100', 10) / 2,
      y: y - 25,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    // Draw arc segments around the circle to show score
    const segments = 36; // Number of segments to draw (36 = 10 degrees each)
    const radius = size / 2;
    const centerX = x;
    const centerY = y;
    
    for (let i = 0; i < segments; i++) {
      const startAngle = (i / segments) * 360;
      const endAngle = ((i + 1) / segments) * 360;
      const midAngle = (startAngle + endAngle) / 2;
      
      // Skip segments beyond the score
      if (startAngle / 360 > scoreValue) continue;
      
      // Calculate start and end points
      const innerRadius = radius - 15;
      const outerRadius = radius - 5;
      
      const startRadians = (startAngle - 90) * (Math.PI / 180);
      const endRadians = (endAngle - 90) * (Math.PI / 180);
      
      const innerStartX = centerX + innerRadius * Math.cos(startRadians);
      const innerStartY = centerY + innerRadius * Math.sin(startRadians);
      
      const outerStartX = centerX + outerRadius * Math.cos(startRadians);
      const outerStartY = centerY + outerRadius * Math.sin(startRadians);
      
      const innerEndX = centerX + innerRadius * Math.cos(endRadians);
      const innerEndY = centerY + innerRadius * Math.sin(endRadians);
      
      const outerEndX = centerX + outerRadius * Math.cos(endRadians);
      const outerEndY = centerY + outerRadius * Math.sin(endRadians);
      
      // Draw segment
      page.drawSvgPath(`M ${innerStartX} ${innerStartY} L ${outerStartX} ${outerStartY} A ${outerRadius} ${outerRadius} 0 0 1 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A ${innerRadius} ${innerRadius} 0 0 0 ${innerStartX} ${innerStartY} Z`, {
        color: accentColor,
        opacity: 0.7 + (i / segments) * 0.3, // More opaque as we progress
      });
    }
  }
  
  /**
   * Helper method to draw page number
   */
  private drawPageNumber(page: any, pageNumber: number) {
    const { width, height } = page.getSize();
    
    page.drawText(`Page ${pageNumber}`, {
      x: width / 2 - 20,
      y: 30,
      size: 10,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    // Footer line
    page.drawLine({
      start: { x: 60, y: 50 },
      end: { x: width - 60, y: 50 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
      opacity: 0.5,
    });
  }
  
  /**
   * Helper method to wrap text to fit within a given width
   */
  private wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    words.forEach(word => {
      const width = font.widthOfTextAtSize(`${currentLine} ${word}`.trim(), fontSize);
      
      if (width < maxWidth) {
        currentLine = `${currentLine} ${word}`.trim();
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    });
    
    if (currentLine.trim() !== '') {
      lines.push(currentLine.trim());
    }
    
    return lines;
  }
} 