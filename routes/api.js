import express from "express";
import Record from "../models/Record.js";
import FullName from "../models/FullName.js";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import { ResumePDFTemplate3 as ResumePDFTemplate } from './pdfGenerator3.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { defaultPrompt } from "../config/prompt.js";

const router = express.Router();

// GET /api/getinfo
router.get("/getinfo", async (req, res) => {
  try {
    const namesData = await FullName.find({}).sort({ name: 1 }).exec();
    const names = namesData.map((n) => n.name);

    res.json({ names, defaultPrompt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get info" });
  }
});

router.post("/addinfo", async (req, res) => {
  try {
    const { fullName, resumeContent } = req.body;
    const newFullName = new FullName({
      name: fullName,
      resumeContent: resumeContent
    });
    await newFullName.save();

    res.json({ success: true, fullname: fullName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get info" });
  }
});

// Get history
router.get("/history", async (req, res) => {
  try {
    const records = await Record.find({}).sort({ createdAt: -1 }).exec();
    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// Generate resume and save record
router.post("/generate", async (req, res) => {
  try {
    const { fullName, prompt, jobDescription, jobLink, companyName, model = "openai" } = req.body;

    let resumeData = {};
    let analysisResult = {};

    // Check if name exists
    let fullNameDoc = await FullName.findOne({ name: fullName });
    if (!fullNameDoc) {
      fullNameDoc = new FullName({ name: fullName });
      await fullNameDoc.save();
    }

    let jsonText = "";
    let masterPrompt = "";

    if (prompt == "") {
      masterPrompt = defaultPrompt.replaceAll("{jd}", jobDescription);
      masterPrompt = masterPrompt.replaceAll("{resumeContent}", fullNameDoc.resumeContent);
    } else {
      masterPrompt = prompt.replaceAll("{jd}", jobDescription);
      masterPrompt = masterPrompt.replaceAll("{resumeContent}", fullNameDoc.resumeContent);
    }

    console.log("masterPrompt: ", masterPrompt);

    if (model === "openai") {
      // Init clients
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      // OpenAI API call
      const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
      const OPENAI_FALLBACK_MODELS = [
        "gpt-4o-mini",
        "gpt-4-turbo",
        "gpt-4",
        "gpt-3.5-turbo",
      ];

      let openaiResponse;
      let lastError;
      const openaiModelsToTry = [
        OPENAI_MODEL,
        ...OPENAI_FALLBACK_MODELS.filter((m) => m !== OPENAI_MODEL),
      ];

      for (const modelToTry of openaiModelsToTry) {
        try {
          console.log(`Attempting to use OpenAI model: ${modelToTry}`);
          openaiResponse = await openai.chat.completions.create({
            model: modelToTry,
            messages: [
              {
                role: "system",
                content:
                  "You are a professional resume writer. Return ONLY valid JSON, no additional text, no markdown formatting, no code blocks.",
              },
              {
                role: "user",
                content: masterPrompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 4096,
            response_format: { type: "json_object" },
          });
          console.log(`Successfully used OpenAI model: ${modelToTry}`);
          break; // Success, exit the loop
        } catch (openaiError) {
          lastError = openaiError;
          console.error(
            `OpenAI model ${modelToTry} failed:`,
            openaiError.status || openaiError.statusCode,
            openaiError.message
          );

          // If it's not a 403 (access denied), don't try other models
          if (openaiError.status !== 403 && openaiError.statusCode !== 403) {
            break;
          }
          // Continue to next model if it's a 403
        }
      }

      // If all models failed, return error
      if (!openaiResponse) {
        console.error("All OpenAI models failed. Last error:", lastError);
        const errorStatus = lastError?.status || lastError?.statusCode || 500;
        const errorMessage =
          lastError?.message || lastError?.error?.message || "Unknown error";

        if (errorStatus === 403) {
          return NextResponse.json(
            {
              error: `OpenAI API access denied. Your account may not have access to the requested models. Tried: ${openaiModelsToTry.join(
                ", "
              )}. Error: ${errorMessage}. Please check your OpenAI account access or try a different model in OPENAI_MODEL.`,
            },
            { status: 403 }
          );
        }
        if (errorStatus === 401) {
          return NextResponse.json(
            {
              error:
                "OpenAI API authentication failed. Please check your OPENAI_API_KEY in .env.local.",
            },
            { status: 401 }
          );
        }
        // Re-throw other errors to be handled by outer catch
        throw lastError;
      }

      // Extract the text content from OpenAI response
      jsonText = openaiResponse.choices[0]?.message?.content || "";
    } else if (model === "anthropic") {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      // Anthropic API call (default)
      const ANTHROPIC_MODEL =
        process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";
      const ANTHROPIC_FALLBACK_MODELS = [
        "claude-3-5-sonnet-20241022",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307",
      ];

      let message;
      let lastError;
      const modelsToTry = [
        ANTHROPIC_MODEL,
        ...ANTHROPIC_FALLBACK_MODELS.filter((m) => m !== ANTHROPIC_MODEL),
      ];

      for (const modelToTry of modelsToTry) {
        try {
          console.log(`Attempting to use Anthropic model: ${modelToTry}`);
          message = await anthropic.messages.create({
            model: modelToTry,
            max_tokens: 4096,
            messages: [
              {
                role: "user",
                content: masterPrompt,
              },
            ],
          });
          console.log(`Successfully used Anthropic model: ${modelToTry}`);
          break; // Success, exit the loop
        } catch (anthropicError) {
          lastError = anthropicError;
          console.error(
            `Anthropic model ${modelToTry} failed:`,
            anthropicError.status || anthropicError.statusCode,
            anthropicError.message
          );

          // If it's not a 403 (access denied), don't try other models
          if (
            anthropicError.status !== 403 &&
            anthropicError.statusCode !== 403
          ) {
            break;
          }
          // Continue to next model if it's a 403
        }
      }

      // If all models failed, return error
      if (!message) {
        console.error("All Anthropic models failed. Last error:", lastError);
        const errorStatus = lastError?.status || lastError?.statusCode || 500;
        const errorMessage =
          lastError?.message || lastError?.error?.message || "Unknown error";

        if (errorStatus === 403) {
          return NextResponse.json(
            {
              error: `Anthropic API access denied. Your account may not have access to the requested models. Tried: ${modelsToTry.join(
                ", "
              )}. Error: ${errorMessage}. Please check your Anthropic account access or try a different model in ANTHROPIC_MODEL.`,
            },
            { status: 403 }
          );
        }
        if (errorStatus === 401) {
          return NextResponse.json(
            {
              error:
                "Anthropic API authentication failed. Please check your ANTHROPIC_API_KEY in .env.local.",
            },
            { status: 401 }
          );
        }
        // Re-throw other errors to be handled by outer catch
        throw lastError;
      }

      // Extract the text content from Anthropic response
      const content = message.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type from Anthropic API");
      }
      jsonText = content.text.trim();
    }

    // Parse the JSON response (works for both APIs)
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedJsonText = jsonText.trim();
      if (cleanedJsonText.startsWith("```json")) {
        cleanedJsonText = cleanedJsonText
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "");
      } else if (cleanedJsonText.startsWith("```")) {
        cleanedJsonText = cleanedJsonText.replace(/```\n?/g, "");
      }
      analysisResult = JSON.parse(cleanedJsonText);
    } catch (parseError) {
      // If parsing fails, return a structured error response
      console.error("Failed to parse JSON response:", jsonText);
      return NextResponse.json(
        {
          error: "Failed to parse AI response",
          rawResponse: jsonText,
        },
        { status: 500 }
      );
    }

    // Return only the resume JSON (remove any analysis fields if present)
    resumeData = analysisResult.updatedResume || analysisResult;

    const fileName = `${fullName.replace(/\s/g, "_")}_resume_${Date.now()}.pdf`;
    const resumePath = path.join("resumes", fileName);

    // Generate PDF
    console.log(`Generating PDF...`);
    const generator = new ResumePDFTemplate(resumeData);
    generator
      .generate()
      .then((pdfBuffer) => {
        writeFileSync(resumePath, pdfBuffer);
        console.log(`✓ PDF generated successfully: ${resumePath}`);
      })
      .catch((error) => {
        console.error(`Error generating PDF: ${error.message}`);
        process.exit(1);
      });

    // Save record to DB
    const record = new Record({
      fullName,
      companyName,
      jobDescription,
      promptUsed: masterPrompt,
      jdLink: jobLink,
      resumeLink: `http://localhost:5000/${resumePath}`.replace("\\", "/"), // for download
    });
    await record.save();

    res.json({ success: true, resumeLink: `http://localhost:5000/${resumePath}`.replace("\\", "/") });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate resume" });
  }
});

export default router;
