
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

export type TaskComplexity = 
  | 'FAST_ANALYSIS'      
  | 'DEEP_REASONING'     
  | 'VISION_ANALYSIS'    
  | 'CREATIVE_EDIT'      
  | 'VIDEO_GENERATION'   
  | 'LOCATION_SERVICES'; 

interface RouterConfig {
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: unknown;
  tools?: unknown[];
  imageConfig?: unknown;
  toolConfig?: unknown;
  thinkingBudget?: number;
}

export class IntelligenceRouter {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  private pickBestModel(complexity: TaskComplexity): string {
    switch (complexity) {
      case 'FAST_ANALYSIS': return 'gemini-3-flash-preview';
      case 'DEEP_REASONING': return 'gemini-3-pro-preview';
      case 'VISION_ANALYSIS': return 'gemini-3-pro-image-preview';
      case 'CREATIVE_EDIT': return 'gemini-2.5-flash-image';
      case 'VIDEO_GENERATION': return 'veo-3.1-fast-generate-preview';
      case 'LOCATION_SERVICES': return 'gemini-2.5-flash'; 
      default: return 'gemini-3-flash-preview';
    }
  }

  async execute(complexity: TaskComplexity, contents: unknown, config: RouterConfig = {}): Promise<GenerateContentResponse> {
    const model = this.pickBestModel(complexity);
    
    if (complexity === 'VIDEO_GENERATION') {
        throw new Error("Video generation requires specific operation handling via generateVideo method.");
    }

    const defaultSystemInstruction = `You are Restoration AI, an expert assistant embedded in a professional mold and water damage mitigation workflow.

You think and communicate like a seasoned restoration technician with deep knowledge of IICRC S500/S520 standards, EPA mold guidelines, and field-level remediation practice.

You help with:
- Interpreting moisture readings, damage classifications, and drying logs
- Drafting scope-of-work, inspection reports, and client-facing summaries
- Identifying equipment needs (air scrubbers, LGR dehumidifiers, HEPA vacuums, air movers)
- Recommending containment strategies and PPE requirements by job type
- Answering questions about material salvageability, demo thresholds, and dry standards
- Sourcing guidance for professional abatement supplies and equipment

You understand:
- Water damage categories (1–3) and classes (1–4)
- Mold containment, negative air pressure setup, and post-remediation verification
- How moisture moves through building assemblies (drywall, subfloor, framing, insulation)
- Coordinating across trades: plumbers, GCs, industrial hygienists, insurance adjusters

Your communication style:
- Direct, field-practical, no filler
- Uses industry terminology correctly
- Flags safety or compliance issues clearly
- Asks clarifying questions when job details are ambiguous

Do not provide legal or insurance claim advice — refer those to the adjuster or attorney.`;

    const generationConfig: Record<string, unknown> = {
        systemInstruction: config.systemInstruction || defaultSystemInstruction,
        responseMimeType: config.responseMimeType,
        responseSchema: config.responseSchema,
        tools: config.tools,
        toolConfig: config.toolConfig,
        imageConfig: config.imageConfig,
    };

    if (config.thinkingBudget && (model === 'gemini-3-pro-preview' || model === 'gemini-3-pro-image-preview')) {
        generationConfig.thinkingConfig = { thinkingBudget: config.thinkingBudget };
    }
    
    return await this.ai.models.generateContent({
      model,
      contents: typeof contents === 'string' ? { parts: [{ text: contents }] } : contents,
      config: generationConfig
    });
  }

  async parseFieldIntent(userInput: string, projectContext: unknown): Promise<GenerateContentResponse> {
      return await this.execute('FAST_ANALYSIS', 
        `You are a restoration AI assistant. Analyze this field technician's input: "${userInput}". 
         Context: ${JSON.stringify(projectContext)}.
         Categorize the input into: 'Psychrometrics', 'Equipment', 'Safety', or 'General'.
         Extract structured data if possible (e.g. temp, rh, count).
         Provide a clean, professional summary sentence.`,
        {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    category: { type: Type.STRING, enum: ['Psychrometrics', 'Equipment', 'Safety', 'General'] },
                    structuredData: { type: Type.OBJECT, description: "Any extracted numbers or entities" },
                    summary: { type: Type.STRING, description: "A polished log entry string" },
                    action: { type: Type.STRING, description: "Suggested system action ID if applicable" }
                }
            }
        }
      );
  }

  async generateScope(projectContext: string): Promise<GenerateContentResponse> {
    return await this.execute('DEEP_REASONING', 
        `Generate a professional mitigation scope (Xactimate style) based on this data: ${projectContext}. 
        Return an array of line items with: code, description, quantity, unit (LF, SF, EA), and rate.`,
        {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    lineItems: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                code: { type: Type.STRING },
                                description: { type: Type.STRING },
                                quantity: { type: Type.NUMBER },
                                unit: { type: Type.STRING },
                                rate: { type: Type.NUMBER }
                            },
                            required: ['code', 'description', 'quantity', 'unit', 'rate']
                        }
                    },
                    justification: { type: Type.STRING }
                }
            }
        }
    );
  }

  async generateTasks(projectContext: string): Promise<GenerateContentResponse> {
    return await this.execute('FAST_ANALYSIS', 
        `Based on the following restoration project details, generate a list of 3-5 recommended tasks.
        Context: ${projectContext}
        Return the tasks as a JSON array of objects, where each object has a 'text' (string) and 'priority' (string: 'high', 'medium', or 'low').`,
        {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING },
                        priority: { type: Type.STRING }
                    },
                    required: ["text", "priority"]
                }
            }
        }
    );
  }

  async generateNarrative(context: { currentStage: string; equipment?: unknown[]; readings?: unknown[]; newPhotosCount?: number; complianceIssues?: string }): Promise<GenerateContentResponse> {
    const prompt = `Act as a professional IICRC-certified Water Mitigation Technician. Write a formal Daily Project Log based on the following data.
    
    DATA SOURCE:
    - Date: ${new Date().toLocaleDateString()}
    - Project Status: ${context.currentStage}
    - Equipment Active: ${context.equipment?.length || 0} units
    - Recent Readings (Last 24h): ${JSON.stringify(context.readings?.slice(-2))}
    - New Photos Taken: ${context.newPhotosCount || 0}
    - Compliance Issues: ${context.complianceIssues || 'None'}
    
    INSTRUCTIONS:
    - Write in past tense, professional tone.
    - Mention specific atmospheric changes if readings are available.
    - Mention equipment manipulation.
    - Mention safety checks.
    - Keep it under 100 words.
    `;

    return await this.execute('DEEP_REASONING', prompt);
  }

  async generateVideo(prompt: string, image?: string) {
      const model = this.pickBestModel('VIDEO_GENERATION');
      const payload: {
          model: string;
          prompt: string;
          config: { numberOfVideos: number; resolution: '720p' | '1080p'; aspectRatio: '16:9' | '9:16' };
          image?: { imageBytes: string; mimeType: string };
      } = {
          model,
          prompt,
          config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
      };
      if (image) {
          payload.image = { imageBytes: image.split(',')[1], mimeType: 'image/png' };
      }
      return await this.ai.models.generateVideos(payload);
  }

  getOperationsClient() {
      return this.ai.operations;
  }
}
