import PDFKit from "pdfkit";
import sharp from "sharp";
import { existsSync } from "fs";
import { join } from "path";

export class ResumePDFTemplate3 {
  constructor(data, headerImagePath) {
    this.data = this._normalizeData(data);
    this.pageWidth = 612; // Letter width in points
    this.pageHeight = 792; // Letter height in points
    this.marginX = 0.4 * 72; // 0.4 inch horizontal
    this.marginT = 0.8 * 72; // 0.8 inch top
    this.marginB = 0.4 * 72; // 0.4 inch bottom
    this.contentWidth = this.pageWidth - 2 * this.marginX;
    this.fontName = "Times-Roman";
    this.fontBold = "Times-Bold";
    this.fontItalic = "Times-Italic";
    this.fontBoldItalic = "Times-BoldItalic";
    this.fontPath = null;
    this.fontBoldPath = null;
    this.fontItalicPath = null;
    this.fontBoldItalicPath = null;

    this._findFonts();
  }

  _normalizeData(data) {
    return {
      name: data.name || "",
      title: data.title || "",
      contact: data.contact || {},
      summary: data.summary || "",
      skills: data.skills || {},
      experience: data.experience || [],
      education: data.education || [],
    };
  }

  _findFonts() {
    const fontsDir = join(process.cwd(), "assets", "fonts", "cambria");
    const regularVariants = ["Cambria.ttf"];
    const boldVariants = ["Cambria-Bold.ttf"];
    const italicVariants = ["Cambria-Italic.ttf"];
    const boldItalicVariants = ["Cambria-BoldItalic.ttf"];

    if (existsSync(fontsDir)) {
      for (const variant of regularVariants) {
        const fontPath = join(fontsDir, variant);
        if (existsSync(fontPath) && !fontPath.toLowerCase().endsWith(".ttc")) {
          this.fontPath = fontPath;
          this.fontName = "Cambria";
          break;
        }
      }

      for (const variant of boldVariants) {
        const fontPath = join(fontsDir, variant);
        if (existsSync(fontPath) && !fontPath.toLowerCase().endsWith(".ttc")) {
          this.fontBoldPath = fontPath;
          this.fontBold = "Cambria-Bold";
          break;
        }
      }

      for (const variant of italicVariants) {
        const fontPath = join(fontsDir, variant);
        if (existsSync(fontPath) && !fontPath.toLowerCase().endsWith(".ttc")) {
          this.fontItalicPath = fontPath;
          this.fontItalic = "Cambria-Italic";
          break;
        }
      }

      for (const variant of boldItalicVariants) {
        const fontPath = join(fontsDir, variant);
        if (existsSync(fontPath) && !fontPath.toLowerCase().endsWith(".ttc")) {
          this.fontBoldItalicPath = fontPath;
          this.fontBoldItalic = "Cambria-BoldItalic";
          break;
        }
      }

      if (!this.fontBoldPath && this.fontPath) this.fontBoldPath = this.fontPath;
      if (!this.fontItalicPath && this.fontPath) this.fontItalicPath = this.fontPath;
      if (!this.fontBoldItalicPath && this.fontBoldPath) this.fontBoldItalicPath = this.fontBoldPath;
    }
  }

  _registerFonts(doc) {
    if (this.fontPath && existsSync(this.fontPath)) {
      try {
        doc.registerFont(this.fontName, this.fontPath);
        if (this.fontBoldPath) doc.registerFont(this.fontBold, this.fontBoldPath);
        if (this.fontItalicPath) doc.registerFont(this.fontItalic, this.fontItalicPath);
        if (this.fontBoldItalicPath) doc.registerFont(this.fontBoldItalic, this.fontBoldItalicPath);
      } catch (e) {
        console.log("Warning: Could not register fonts:", e.message || e);
        this.fontName = "Times-Roman";
        this.fontBold = "Times-Bold";
        this.fontItalic = "Times-Italic";
        this.fontBoldItalic = "Times-BoldItalic";
      }
    }
  }

  _addName(doc) {
    const name = this.data.name || "";
    const title = this.data.title || "";

    doc.font(this.fontBold).fontSize(24).fillColor("#2C3E50").text(name, this.marginX, this.marginT, {
      width: this.contentWidth,
      align: "left",
    });

    doc.moveDown(0.3);

    if (title) {
      doc.font(this.fontName).fontSize(16).fillColor("#4A4A4A").text(title, {
        width: this.contentWidth,
        align: "left",
      });
    }

    doc.moveDown(0.5);
  }

  _addContact(doc) {
    const contact = this.data.contact || {};
    const address = contact.address || "";
    const email = contact.email || "";
    const phone = contact.phone || "";

    doc.fontSize(12).fillColor("#4A4A4A");

    const startY = doc.y;
    const addressAndPhone = `${address} | ${phone} | `;
    doc.font(this.fontName).text(addressAndPhone, this.marginX, startY);

    doc.fillColor("#0066CC").text(email, this.marginX + doc.widthOfString(addressAndPhone), startY, {
      link: `mailto:${email}`,
      underline: true,
    });

    doc.fillColor("#4A4A4A");
    doc.moveDown(1);
  }

  _addSectionHeader(doc, title) {
    const headerFontSize = 12;
    const headerHeight = headerFontSize * 1.5;
    const paddingVertical = headerFontSize * 0.15;
    const spacingAfter = headerFontSize * 0.5;

    const contentFontSize = 11;
    const sectionTitleHeight = contentFontSize * 1.2;
    const sectionTitleSpacing = contentFontSize * 0.3;
    const minContentLineHeight = contentFontSize * 1.2;
    const minContentSpace = sectionTitleHeight + sectionTitleSpacing + minContentLineHeight + contentFontSize * 0.3;

    const totalSpaceNeeded = headerHeight + spacingAfter + minContentSpace;

    const currentY = doc.y;
    const spaceAvailable = this.pageHeight - this.marginB - currentY;

    if (spaceAvailable < totalSpaceNeeded) doc.addPage();

    const startY = doc.y;
    const fontSize = headerFontSize;
    const titleText = title.toUpperCase();

    doc.opacity(1);
    doc.font(this.fontBold).fontSize(fontSize).fillColor("#2C3E50").text(titleText, this.marginX + paddingVertical, startY + paddingVertical, {
      width: this.contentWidth,
      align: "left",
    });

    const lineY = doc.y + 3;
    doc.moveTo(this.marginX, lineY).lineTo(this.marginX + this.contentWidth, lineY).strokeColor("#2C3E50").lineWidth(2).stroke();

    doc.moveDown(0.5);
  }

  _estimateTextHeight(doc, text, width, fontSize, lineHeight) {
    const effectiveLineHeight = lineHeight || fontSize * 1.2;

    // Save current font and font size
    const savedFont = doc._font ? doc._font.name : null;
    const savedFontSize = doc._fontSize || 12;

    // Temporarily set font size for measurement
    doc.fontSize(fontSize);

    try {
      const words = text.split(" ");
      let currentLine = "";
      let lines = 1;

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        let lineWidth;

        try {
          lineWidth = doc.widthOfString(testLine);
        } catch (e) {
          const avgCharWidth = fontSize * 0.6;
          lineWidth = testLine.length * avgCharWidth;
        }

        if (lineWidth > width) {
          if (currentLine) {
            lines++;
            currentLine = word;
          } else {
            let wordWidth;
            try {
              wordWidth = doc.widthOfString(word);
            } catch (e) {
              const avgCharWidth = fontSize * 0.6;
              wordWidth = word.length * avgCharWidth;
            }
            lines += Math.max(1, Math.ceil(wordWidth / width));
            currentLine = "";
          }
        } else {
          currentLine = testLine;
        }
      }

      if (savedFont) {
        doc.font(savedFont).fontSize(savedFontSize);
      } else {
        doc.fontSize(savedFontSize);
      }

      return lines * effectiveLineHeight;
    } catch (e) {
      if (savedFont) {
        doc.font(savedFont).fontSize(savedFontSize);
      } else {
        doc.fontSize(savedFontSize);
      }

      const avgCharsPerLine = Math.floor(width / (fontSize * 0.6));
      const estimatedLines = Math.max(1, Math.ceil(text.length / avgCharsPerLine));
      return estimatedLines * effectiveLineHeight;
    }
  }

  _addSummary(doc) {
    this._addSectionHeader(doc, "SUMMARY");
    const summary = (this.data.summary || "").replace(/\n/g, " ");

    doc.font(this.fontName).fontSize(11).fillColor("#333333").text(summary, {
      width: this.contentWidth,
      align: "left",
      paragraphGap: 3,
    });

    doc.moveDown(1);
  }

  _addSkills(doc) {
    this._addSectionHeader(doc, "SKILLS");
    const skills = this.data.skills || {};

    doc.font(this.fontName).fontSize(11).fillColor("#333333");

    for (const [category, items] of Object.entries(skills)) {
      const itemsText = items.join(", ");
      const categoryText = `${category}: `;
      const fullText = categoryText + itemsText;

      const fontSize = 11;
      const estimatedHeight = this._estimateTextHeight(doc, fullText, this.contentWidth, fontSize);
      const spacingAfter = fontSize * 0.3;
      const minSpaceNeeded = estimatedHeight + spacingAfter;

      const currentY = doc.y;
      const spaceAvailable = this.pageHeight - this.marginB - currentY;

      if (spaceAvailable < minSpaceNeeded) {
        doc.addPage();
      }

      doc.font(this.fontBold).text(categoryText, this.marginX, doc.y, {
        width: this.contentWidth,
        align: "left",
        continued: true,
      });
      doc.font(this.fontName).text(itemsText);
      doc.moveDown(0.3);
    }

    doc.moveDown(1);
  }

  _addExperience(doc) {
    this._addSectionHeader(doc, "WORK HISTORY");
    const experiences = this.data.experience || [];

    for (const exp of experiences) {
      // Calculate space needed for this experience entry
      const titleFontSize = 12;
      const companyFontSize = 11;
      const titleHeight = titleFontSize * 1.2;
      const companyHeight = companyFontSize * 1.2;
      const companyLineHeight = companyFontSize * 1.2;
      const spacingAfterCompany = companyLineHeight * 0.5;
      const minContentSpace = companyFontSize * 2.5;

      const minSpaceNeeded = titleHeight + companyHeight + spacingAfterCompany + minContentSpace;
      const currentY = doc.y;
      const spaceAvailable = this.pageHeight - this.marginB - currentY;

      if (spaceAvailable < minSpaceNeeded) {
        doc.addPage();
      }

      // Render job title
      doc
        .font(this.fontBold)
        .fontSize(titleFontSize)
        .fillColor("#2C3E50")
        .text(exp.title || "", this.marginX, doc.y, {
          width: this.contentWidth,
          align: "left",
        });

      const company = exp.company || "";
      const dateRange = exp.date_range || "";
      const location = exp.location || "";
      const companyText = company.trim();
      const dateLocation = location ? `${dateRange} | ${location}`.trim() : dateRange.trim();

      const col1Width = this.contentWidth * 0.5;
      const col2Width = this.contentWidth * 0.5;
      let lineY = doc.y;
      const lineHeight = doc.currentLineHeight(true) || 13;

      const spaceNeededForCompany = companyHeight + spacingAfterCompany + minContentSpace;
      const spaceAvailableForCompany = this.pageHeight - this.marginB - lineY;

      if (spaceAvailableForCompany < spaceNeededForCompany) {
        doc.addPage();
        lineY = this.marginT;
      }

      // Render company and date
      doc
        .font(this.fontName)
        .fontSize(11)
        .fillColor("#555555")
        .text(companyText, this.marginX, lineY, { width: col1Width, align: "left" });

      doc.text(dateLocation, this.marginX + col1Width, lineY, { width: col2Width, align: "right" });

      doc.y = lineY + lineHeight;
      doc.moveDown(0.5);

      // Responsibilities
      const responsibilities = exp.responsibilities || [];
      if (responsibilities.length > 0) {
        const titleFontSize = 11;
        const contentFontSize = 11;
        const titleHeight = titleFontSize * 1.2;
        const titleSpacing = titleFontSize * 0.3;
        const contentSpacing = contentFontSize * 0.3;
        const paragraphGap = 2;

        let totalContentHeight = 0;
        doc.font(this.fontName).fontSize(contentFontSize);
        for (const responsibility of responsibilities) {
          const respText = String(responsibility).replace(/\n/g, " ");
          const bulletText = `• ${respText}`;
          const itemHeight = this._estimateTextHeight(doc, bulletText, this.contentWidth - 18, contentFontSize);
          totalContentHeight += itemHeight + paragraphGap;
        }

        const totalSpaceNeeded = titleHeight + titleSpacing + totalContentHeight + contentSpacing;
        const currentY = doc.y;
        const spaceAvailable = this.pageHeight - this.marginB - currentY;
        const minSpaceRequired = titleHeight + titleSpacing + contentFontSize * 1.2;

        if (spaceAvailable < minSpaceRequired) {
          doc.addPage();
        } else if (spaceAvailable < totalSpaceNeeded && spaceAvailable < minSpaceRequired * 2) {
          doc.addPage();
        }

        doc
          .font(this.fontBold)
          .fontSize(titleFontSize)
          .fillColor("#2C3E50")
          .text("Key Qualifications & Responsibilities", this.marginX + 18, doc.y, {
            width: this.contentWidth,
            align: "left",
          });
        doc.moveDown(0.3);

        doc.font(this.fontName).fontSize(contentFontSize).fillColor("#333333");

        for (const responsibility of responsibilities) {
          const respText = String(responsibility).replace(/\n/g, " ");
          const bulletX = this.marginX + 18;
          const bulletText = `• ${respText}`;
          doc.text(bulletText, bulletX, doc.y, {
            width: this.contentWidth - 18,
            align: "left",
            paragraphGap: 2,
          });
        }
        doc.moveDown(0.3);
      }

      // Achievements
      const achievements = exp.achievements || [];
      if (achievements.length > 0) {
        const titleFontSize = 11;
        const contentFontSize = 11;
        const titleHeight = titleFontSize * 1.2;
        const titleSpacing = titleFontSize * 0.3;
        const contentSpacing = contentFontSize * 0.3;
        const paragraphGap = 2;

        let totalContentHeight = 0;
        doc.font(this.fontName).fontSize(contentFontSize);
        for (const achievement of achievements) {
          const achText = String(achievement).replace(/\n/g, " ");
          const bulletText = `• ${achText}`;
          const itemHeight = this._estimateTextHeight(doc, bulletText, this.contentWidth - 18, contentFontSize);
          totalContentHeight += itemHeight + paragraphGap;
        }

        const totalSpaceNeeded = titleHeight + titleSpacing + totalContentHeight + contentSpacing;
        const currentY = doc.y;
        const spaceAvailable = this.pageHeight - this.marginB - currentY;
        const minSpaceRequired = titleHeight + titleSpacing + contentFontSize * 1.2;

        if (spaceAvailable < minSpaceRequired) {
          doc.addPage();
        } else if (spaceAvailable < totalSpaceNeeded && spaceAvailable < minSpaceRequired * 2) {
          doc.addPage();
        }

        doc
          .font(this.fontBold)
          .fontSize(titleFontSize)
          .fillColor("#2C3E50")
          .text("Key Achievements", this.marginX + 18, doc.y, {
            width: this.contentWidth,
            align: "left",
          });
        doc.moveDown(0.3);

        doc.font(this.fontName).fontSize(contentFontSize).fillColor("#333333");

        for (const achievement of achievements) {
          const achText = String(achievement).replace(/\n/g, " ");
          const bulletX = this.marginX + 18;
          const bulletText = `• ${achText}`;
          doc.text(bulletText, bulletX, doc.y, {
            width: this.contentWidth - 18,
            align: "left",
            paragraphGap: 2,
          });
        }
        doc.moveDown(0.3);
      }

      // Skills in company
      const skillsInCompany = exp.skills;
      if (skillsInCompany) {
        const skillsText = Array.isArray(skillsInCompany)
          ? skillsInCompany.join(", ")
          : String(skillsInCompany);
        const bulletX = this.marginX + 18;
        doc.font(this.fontBoldItalic).fontSize(11).fillColor("#2C3E50");
        doc.text("Skills: ", bulletX, doc.y, {
          width: this.contentWidth - 18,
          align: "left",
          continued: true,
        });
        doc.font(this.fontItalic).fillColor("#333333").text(skillsText);
        doc.moveDown(0.3);
      }

      doc.moveDown(0.3);
    }

    doc.moveDown(0.7);
  }

  _addEducation(doc) {
    this._addSectionHeader(doc, "EDUCATION");
    const educationList = this.data.education || [];

    for (const edu of educationList) {
      const degreeFontSize = 12;
      const institutionFontSize = 11;
      const degreeHeight = degreeFontSize * 1.2;
      const institutionHeight = institutionFontSize * 1.2;
      const spacingAfterInstitution = institutionFontSize * 1;
      const minContentSpace = institutionFontSize * 1;

      const minSpaceNeeded = degreeHeight + institutionHeight + spacingAfterInstitution + minContentSpace;
      const currentY = doc.y;
      const spaceAvailable = this.pageHeight - this.marginB - currentY;

      if (spaceAvailable < minSpaceNeeded) {
        doc.addPage();
      }

      doc.font(this.fontBold).fontSize(degreeFontSize).fillColor("#2C3E50").text(edu.degree || "", this.marginX, doc.y, {
        width: this.contentWidth,
        align: "left",
      });

      const institution = edu.institution || "";
      const dateRange = edu.date_range || "";
      const location = edu.location || "";
      const institutionText = institution.trim();
      const dateLocation = location ? `${dateRange} | ${location}`.trim() : dateRange.trim();

      const col1Width = this.contentWidth * 0.5;
      const col2Width = this.contentWidth * 0.5;
      let lineY = doc.y;
      const lineHeight = doc.currentLineHeight(true) || 13;

      const spaceNeededForInstitution = institutionHeight + spacingAfterInstitution + minContentSpace;
      const spaceAvailableForInstitution = this.pageHeight - this.marginB - lineY;

      if (spaceAvailableForInstitution < spaceNeededForInstitution) {
        doc.addPage();
        lineY = this.marginT;
      }

      doc.font(this.fontName).fontSize(11).fillColor("#555555").text(institutionText, this.marginX, lineY, {
        width: col1Width,
        align: "left",
      });

      doc.text(dateLocation, this.marginX + col1Width, lineY, {
        width: col2Width,
        align: "right",
      });

      doc.y = lineY + lineHeight;
      doc.moveDown(1);
    }
  }

  async generate() {
    return new Promise((resolve, reject) => {
      try {
        const PDFDoc = PDFKit;
        const doc = new PDFDoc({
          size: "LETTER",
          margins: {
            top: this.marginT,
            bottom: this.marginB,
            left: this.marginX,
            right: this.marginX,
          },
        });

        this._registerFonts(doc);

        const buffers = [];
        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.on("error", reject);

        this._addName(doc);
        this._addContact(doc);
        this._addSummary(doc);
        this._addSkills(doc);
        this._addExperience(doc);
        this._addEducation(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
