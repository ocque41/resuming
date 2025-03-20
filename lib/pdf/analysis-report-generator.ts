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
  private fileType: string;
  
  constructor(analysis: any, documentName: string) {
    this.analysis = analysis;
    this.documentName = documentName;
    this.generatedDate = new Date();
    
    // Determine the file type from the analysis or default to 'document'
    this.fileType = analysis.fileType || analysis.analysisType || 'document';
    console.log(`AnalysisReportGenerator initialized for ${this.fileType} file: ${documentName}`);
  }
  
  /**
   * Generate a PDF report from the analysis data
   * @returns Buffer containing the PDF data
   */
  async generatePDF(): Promise<Uint8Array> {
    // Create a new PDF document
    this.pdfDoc = await PDFDocument.create();
    
    // Add metadata to the document
    this.pdfDoc.setTitle(`Document Analysis Report - ${this.documentName}`);
    this.pdfDoc.setAuthor('CV Optimizer');
    this.pdfDoc.setSubject('Document Analysis Report');
    this.pdfDoc.setKeywords(['analysis', 'report', 'document', this.fileType]);
    this.pdfDoc.setCreationDate(this.generatedDate);
    this.pdfDoc.setModificationDate(this.generatedDate);
    
    console.log(`Generating PDF report for ${this.fileType} file: ${this.documentName}`);
    
    // Add pages to the document
    await this.addCoverPage();
    await this.addSummaryPage();
    
    // Add type-specific content pages
    switch (this.fileType) {
      case 'spreadsheet':
        await this.addSpreadsheetAnalysisPages();
        break;
      case 'presentation':
        await this.addPresentationAnalysisPages();
        break;
      case 'document':
      default:
        await this.addContentAnalysisPage();
        await this.addSentimentAnalysisPage();
        await this.addKeyInformationPage();
        break;
    }
    
    console.log(`PDF report generated for ${this.documentName} with ${this.pdfDoc.getPageCount()} pages`);
    
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
    
    // Add title with file type
    let reportTitle = "DOCUMENT ANALYSIS REPORT";
    if (this.fileType === 'spreadsheet') {
      reportTitle = "SPREADSHEET ANALYSIS REPORT";
    } else if (this.fileType === 'presentation') {
      reportTitle = "PRESENTATION ANALYSIS REPORT";
    }
    
    page.drawText(reportTitle, {
      x: width / 2 - (reportTitle.length * 7), // Rough center alignment
      y: height / 2 + 100,
      size: 24,
      font: helveticaBold,
      color: textColor,
    });
    
    // Add document name
    const nameLines = this.wrapText(this.documentName, helvetica, 18, width - 200);
    nameLines.forEach((line, i) => {
      page.drawText(line, {
        x: width / 2 - (line.length * 5), // Rough center alignment
        y: height / 2 + 50 - (i * 30),
        size: 18,
        font: helvetica,
        color: textColor,
      });
    });
    
    // Add date
    const dateText = `Generated on ${this.generatedDate.toLocaleDateString()}`;
    page.drawText(dateText, {
      x: width / 2 - (dateText.length * 4), // Rough center alignment
      y: height / 2 - 50,
      size: 14,
      font: helvetica,
      color: textColor,
    });
    
    // Add file type indicator
    const fileTypeText = `File Type: ${this.getHumanReadableFileType()}`;
    page.drawText(fileTypeText, {
      x: width / 2 - (fileTypeText.length * 4), // Rough center alignment
      y: height / 2 - 80,
      size: 14,
      font: helvetica,
      color: textColor,
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
    
    // Brand colors
    const brandColor = rgb(0.05, 0.05, 0.05); // Dark gray
    const accentColor = rgb(0.7, 0.57, 0.42); // Tan
    const lightColor = rgb(0.98, 0.96, 0.93); // Off-white
    
    // Add the title of the page with underline
    page.drawText('EXECUTIVE SUMMARY', {
      x: 50,
      y: height - 100,
      size: 20,
      font: helveticaBold,
      color: brandColor,
    });
    
    page.drawLine({
      start: { x: 50, y: height - 110 },
      end: { x: width - 50, y: height - 110 },
      thickness: 2,
      color: accentColor,
    });
    
    // Calculate overall score and circle
    const summaryData = this.getSummaryData();
    const score = summaryData.score;
    const message = summaryData.message;
    
    // Draw the score circle
    const circleX = width / 2;
    const circleY = height - 200;
    const circleRadius = 60;
    
    // Draw the background circle
    page.drawCircle({
      x: circleX,
      y: circleY,
      size: circleRadius * 2,
      color: accentColor,
    });
    
    // Draw the score text
    page.drawText(`${score}`, {
      x: circleX - 25,
      y: circleY - 10,
      size: 40,
      font: helveticaBold,
      color: lightColor,
    });
    
    // Draw the score label
    page.drawText('Document Score', {
      x: circleX - 60,
      y: circleY - 100,
      size: 16,
      font: helveticaBold,
      color: brandColor,
    });
    
    // Draw the document quality message
    const messageY = height - 350;
    page.drawText(message, {
      x: 50,
      y: messageY,
      size: 14,
      font: helvetica,
      color: brandColor,
    });
    
    // Draw highlights section
    page.drawText('Key Strengths:', {
      x: 50,
      y: messageY - 40,
      size: 16,
      font: helveticaBold,
      color: brandColor,
    });
    
    const highlights = this.getHighlights();
    highlights.forEach((highlight: string, i: number) => {
      page.drawText(`• ${highlight}`, {
        x: 70,
        y: messageY - 70 - (i * 25),
        size: 12,
        font: helvetica,
        color: brandColor,
      });
    });
    
    // Draw suggestions section
    const suggestionsY = messageY - 70 - (highlights.length * 25) - 30;
    page.drawText('Improvement Suggestions:', {
      x: 50,
      y: suggestionsY,
      size: 16,
      font: helveticaBold,
      color: brandColor,
    });
    
    const suggestions = this.getSuggestions();
    suggestions.forEach((suggestion: string, i: number) => {
      page.drawText(`• ${suggestion}`, {
        x: 70,
        y: suggestionsY - 30 - (i * 25),
        size: 12,
        font: helvetica,
        color: brandColor,
      });
    });
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
  
  /**
   * Add spreadsheet-specific analysis pages to the report
   */
  private async addSpreadsheetAnalysisPages() {
    console.log('Adding spreadsheet analysis pages');
    
    // For now, just add generic content pages as a fallback
    await this.addContentAnalysisPage();
    
    // Add data quality metrics if available
    if (this.analysis.dataQualityAssessment) {
      await this.addSpreadsheetDataQualityPage();
    }
    
    console.log('Spreadsheet analysis pages added');
  }
  
  /**
   * Add presentation-specific analysis pages to the report
   */
  private async addPresentationAnalysisPages() {
    console.log('Adding presentation analysis pages');
    
    // For now, just add generic content pages as a fallback
    await this.addContentAnalysisPage();
    
    // Add presentation structure metrics if available
    if (this.analysis.presentationStructure) {
      await this.addPresentationStructurePage();
    }
    
    console.log('Presentation analysis pages added');
  }
  
  /**
   * Add a data quality page for spreadsheet analysis
   */
  private async addSpreadsheetDataQualityPage() {
    const page = this.pdfDoc!.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    
    // Load fonts
    const helveticaBold = await this.pdfDoc!.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await this.pdfDoc!.embedFont(StandardFonts.Helvetica);
    
    // Brand colors
    const brandColor = rgb(0.05, 0.05, 0.05);
    const accentColor = rgb(0.7, 0.57, 0.42);
    
    // Add page header
    await this.drawHeader(page, 'DATA QUALITY ASSESSMENT', helveticaBold, brandColor);
    
    // Draw data quality metrics if available
    const quality = this.analysis.dataQualityAssessment;
    
    if (quality) {
      // Draw quality metrics
      const metricsY = height - 150;
      const metrics = [
        { name: 'Completeness', score: quality.completenessScore },
        { name: 'Consistency', score: quality.consistencyScore },
        { name: 'Accuracy', score: quality.accuracyScore },
        { name: 'Overall Data Quality', score: quality.overallDataQualityScore }
      ];
      
      // Draw each metric as a gauge
      metrics.forEach((metric, index) => {
        const y = metricsY - (index * 100);
        
        page.drawText(metric.name, {
          x: 50,
          y: y + 40,
          size: 14,
          font: helveticaBold,
          color: brandColor,
        });
        
        this.drawScoreGauge(page, 150, y, 30, metric.score, helveticaBold);
      });
      
      // Draw quality issues if available
      if (quality.qualityIssues && quality.qualityIssues.length > 0) {
        const issuesY = metricsY - 450;
        
        page.drawText('Quality Issues Identified:', {
          x: 50,
          y: issuesY,
          size: 14,
          font: helveticaBold,
          color: brandColor,
        });
        
        quality.qualityIssues.slice(0, 5).forEach((issue: any, i: number) => {
          const issueText = `• ${issue.issue} (${issue.severity})`;
          const recText = `   Recommendation: ${issue.recommendation}`;
          
          page.drawText(issueText, {
            x: 50,
            y: issuesY - 30 - (i * 50),
            size: 12,
            font: helvetica,
            color: brandColor,
          });
          
          page.drawText(recText, {
            x: 50,
            y: issuesY - 50 - (i * 50),
            size: 10,
            font: helvetica,
            color: brandColor,
          });
        });
      }
    } else {
      // Draw fallback message if no data quality metrics
      page.drawText('No data quality metrics available for this spreadsheet.', {
        x: 50,
        y: height - 150,
        size: 12,
        font: helvetica,
        color: brandColor,
      });
    }
    
    // Add page number
    this.drawPageNumber(page, this.pdfDoc!.getPageCount());
  }
  
  /**
   * Add a presentation structure page
   */
  private async addPresentationStructurePage() {
    const page = this.pdfDoc!.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    
    // Load fonts
    const helveticaBold = await this.pdfDoc!.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await this.pdfDoc!.embedFont(StandardFonts.Helvetica);
    
    // Brand colors
    const brandColor = rgb(0.05, 0.05, 0.05);
    const accentColor = rgb(0.7, 0.57, 0.42);
    
    // Add page header
    await this.drawHeader(page, 'PRESENTATION STRUCTURE ANALYSIS', helveticaBold, brandColor);
    
    // Draw presentation structure metrics if available
    const structure = this.analysis.presentationStructure;
    
    if (structure) {
      const contentY = height - 150;
      
      // Draw structure metrics
      page.drawText(`Slide Count: ${structure.slideCount || 'N/A'}`, {
        x: 50,
        y: contentY,
        size: 14,
        font: helveticaBold,
        color: brandColor,
      });
      
      page.drawText(`Introduction: ${structure.hasIntroduction ? 'Yes' : 'No'}`, {
        x: 50,
        y: contentY - 30,
        size: 12,
        font: helvetica,
        color: brandColor,
      });
      
      page.drawText(`Conclusion: ${structure.hasConclusion ? 'Yes' : 'No'}`, {
        x: 50,
        y: contentY - 60,
        size: 12,
        font: helvetica,
        color: brandColor,
      });
      
      page.drawText(`Narrative Flow: ${structure.narrativeFlow || 'N/A'}`, {
        x: 50,
        y: contentY - 90,
        size: 12,
        font: helvetica,
        color: brandColor,
      });
      
      // Draw structure score
      if (structure.structureScore) {
        page.drawText('Structure Quality Score:', {
          x: 50,
          y: contentY - 130,
          size: 14,
          font: helveticaBold,
          color: brandColor,
        });
        
        this.drawScoreGauge(page, 250, contentY - 160, 40, structure.structureScore, helveticaBold);
      }
      
      // Draw slide structure if available
      if (structure.slideStructure && structure.slideStructure.length > 0) {
        const slideY = contentY - 220;
        
        page.drawText('Slide Structure Analysis:', {
          x: 50,
          y: slideY,
          size: 14,
          font: helveticaBold,
          color: brandColor,
        });
        
        page.drawText('Type', {
          x: 50,
          y: slideY - 30,
          size: 12,
          font: helveticaBold,
          color: brandColor,
        });
        
        page.drawText('Purpose', {
          x: 150,
          y: slideY - 30,
          size: 12,
          font: helveticaBold,
          color: brandColor,
        });
        
        page.drawText('Effectiveness', {
          x: 350,
          y: slideY - 30,
          size: 12,
          font: helveticaBold,
          color: brandColor,
        });
        
        // Draw a line under the headers
        page.drawLine({
          start: { x: 50, y: slideY - 35 },
          end: { x: 500, y: slideY - 35 },
          thickness: 1,
          color: accentColor,
        });
        
        // Only show the first 8 slides to avoid overflow
        structure.slideStructure.slice(0, 8).forEach((slide: any, i: number) => {
          const y = slideY - 60 - (i * 25);
          
          page.drawText(slide.type || 'N/A', {
            x: 50,
            y,
            size: 10,
            font: helvetica,
            color: brandColor,
          });
          
          // Truncate purpose if too long
          const purpose = slide.purpose && slide.purpose.length > 25 
            ? slide.purpose.substring(0, 22) + '...' 
            : (slide.purpose || 'N/A');
          
          page.drawText(purpose, {
            x: 150,
            y,
            size: 10,
            font: helvetica,
            color: brandColor,
          });
          
          page.drawText(`${slide.effectiveness || 'N/A'}/10`, {
            x: 350,
            y,
            size: 10,
            font: helvetica,
            color: brandColor,
          });
        });
      }
    } else {
      // Draw fallback message if no structure data
      page.drawText('No structure analysis available for this presentation.', {
        x: 50,
        y: height - 150,
        size: 12,
        font: helvetica,
        color: brandColor,
      });
    }
    
    // Add page number
    this.drawPageNumber(page, this.pdfDoc!.getPageCount());
  }
  
  /**
   * Get a human-readable representation of the file type
   */
  private getHumanReadableFileType(): string {
    switch (this.fileType) {
      case 'spreadsheet':
        return 'Spreadsheet (Excel/CSV)';
      case 'presentation':
        return 'Presentation (PowerPoint)';
      case 'cv':
        return 'CV/Resume';
      case 'document':
      default:
        return 'Document (PDF/Word)';
    }
  }
  
  /**
   * Get summary data for the document analysis
   * @returns Object containing score and message
   */
  private getSummaryData(): { score: number; message: string } {
    // Default values
    const defaultScore = 75;
    const defaultMessage = 'This document meets quality standards and is well-structured.';
    
    // Try to extract score from analysis data
    let score = defaultScore;
    let message = defaultMessage;
    
    // Get score from analysis if available
    if (this.analysis.score) {
      score = this.analysis.score;
    } else if (this.analysis.overallScore) {
      score = this.analysis.overallScore;
    } else if (this.analysis.documentQuality?.overallScore) {
      score = this.analysis.documentQuality.overallScore;
    }
    
    // Get message based on score range
    if (score >= 90) {
      message = 'Excellent document quality. Professional, well-structured, and engaging.';
    } else if (score >= 80) {
      message = 'Very good document quality. Minor improvements could enhance overall impact.';
    } else if (score >= 70) {
      message = 'Good document quality. Some areas could benefit from refinement.';
    } else if (score >= 60) {
      message = 'Average document quality. Several areas need improvement.';
    } else {
      message = 'Below average document quality. Significant improvements recommended.';
    }
    
    return { score, message };
  }
  
  /**
   * Get highlights (strengths) from the analysis
   * @returns Array of highlight strings
   */
  private getHighlights(): string[] {
    // Default highlights
    const defaultHighlights = [
      'Well-structured document',
      'Clear presentation of information',
      'Appropriate length for content type'
    ];
    
    // Try to extract highlights from analysis data
    if (this.analysis.highlights && Array.isArray(this.analysis.highlights)) {
      return this.analysis.highlights.slice(0, 5); // Limit to top 5
    }
    
    if (this.analysis.strengths && Array.isArray(this.analysis.strengths)) {
      return this.analysis.strengths.slice(0, 5); // Limit to top 5
    }
    
    if (this.analysis.keyPoints?.strengths && Array.isArray(this.analysis.keyPoints.strengths)) {
      return this.analysis.keyPoints.strengths.slice(0, 5); // Limit to top 5
    }
    
    return defaultHighlights;
  }
  
  /**
   * Get improvement suggestions from the analysis
   * @returns Array of suggestion strings
   */
  private getSuggestions(): string[] {
    // Default suggestions
    const defaultSuggestions = [
      'Enhance structure with clearer section headings',
      'Consider adding visual elements for key information',
      'Review for consistency in formatting and style'
    ];
    
    // Try to extract suggestions from analysis data
    if (this.analysis.suggestions && Array.isArray(this.analysis.suggestions)) {
      return this.analysis.suggestions.slice(0, 5); // Limit to top 5
    }
    
    if (this.analysis.weaknesses && Array.isArray(this.analysis.weaknesses)) {
      return this.analysis.weaknesses.slice(0, 5); // Limit to top 5
    }
    
    if (this.analysis.keyPoints?.weaknesses && Array.isArray(this.analysis.keyPoints.weaknesses)) {
      return this.analysis.keyPoints.weaknesses.slice(0, 5); // Limit to top 5
    }
    
    return defaultSuggestions;
  }
} 