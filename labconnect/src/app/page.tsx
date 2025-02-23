"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

interface Lab {
  id: number;
  Department: string;
  "Professor Name": string;
  Contact: string;
  "Lab Name": string;
  Major: string;
  "How to apply": string;
  Description: string;
}

interface LabAnalysis extends Lab {
  match_reason?: string;
  similarity_score?: number;
}

interface ResumeDetails {
  major: string;
  keywords: string;
}

export default function LabSearch() {
  const [image, setImage] = useState<File | null>(null);
  const [labs, setLabs] = useState<LabAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImage(event.target.files?.[0] || null);
  };

  const processImageAndFetchLabs = async () => {
    if (!image) {
      setError("Please upload an image");
      return;
    }

    setLoading(true);
    setError(null);
    setLabs([]);

    try {
      // Convert image to base64
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result?.toString();
          if (!result) return reject("Failed to read image");
          resolve(result.split(",")[1]);
        };
        reader.onerror = () => reject("Error reading image file");
        reader.readAsDataURL(image);
      });

      // First LLM call: Extract resume details (major and keywords)
      const resumeResponse = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content:
              "Extract the academic major and key skills or research interests from this resume image. Respond in the format: Major: <major>\nKeywords: <comma-separated keywords>.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Analyze this resume image and extract the most relevant academic major along with additional keywords that represent skills or interests.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${b64}`,
                  detail: "auto",
                },
              },
            ],
          },
        ],
        max_tokens: 150,
      });

      const resumeContent = resumeResponse.choices[0]?.message?.content?.trim();
      if (!resumeContent) throw new Error("Failed to extract resume details");

      // Parse the text response
      const majorMatch = resumeContent.match(/Major:\s*(.+)/);
      const keywordsMatch = resumeContent.match(/Keywords:\s*(.+)/);

      if (!majorMatch || !keywordsMatch) {
        throw new Error("Failed to parse resume details");
      }

      const resumeDetails: ResumeDetails = {
        major: majorMatch[1].trim(),
        keywords: keywordsMatch[1].trim(),
      };

      // Fetch all labs from Supabase
      const { data: allLabs, error: supabaseError } = await supabase
        .from("labconnect")
        .select();

      if (supabaseError) throw supabaseError;
      if (!allLabs?.length) throw new Error("No labs found");

      // Second LLM call: Compare resume details with lab descriptions
      const comparisonResponse = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `Analyze the following resume details and compare them with these lab descriptions. For each lab, provide:
- A similarity score (1-5)
- A match reason (short bullet points explaining the match)
Consider the applicant's major ("${resumeDetails.major}") and keywords ("${resumeDetails.keywords}") in your analysis.
Respond in the following format for each lab:
Lab ID: <id>
Similarity Score: <score>
Match Reason: <reason>
---`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Resume Details:\nMajor: ${resumeDetails.major}\nKeywords: ${resumeDetails.keywords}\n\nLab Descriptions:\n${JSON.stringify(allLabs, null, 2)}`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${b64}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });

      const analysisContent = comparisonResponse.choices[0]?.message?.content;
      if (!analysisContent) throw new Error("Failed to get lab analysis from LLM");

      // Parse the text response
      const labAnalysis = analysisContent
        .split("---")
        .map((block) => {
          const idMatch = block.match(/Lab ID:\s*(\d+)/);
          const scoreMatch = block.match(/Similarity Score:\s*(\d+)/);
          const reasonMatch = block.match(/Match Reason:\s*([\s\S]+)/);

          if (!idMatch || !scoreMatch || !reasonMatch) return null;

          return {
            id: parseInt(idMatch[1]),
            similarity_score: parseInt(scoreMatch[1]),
            match_reason: reasonMatch[1].trim(),
          };
        })
        .filter((lab) => lab !== null) as {
        id: number;
        similarity_score: number;
        match_reason: string;
      }[];

      // Merge the lab analysis with the original lab data and sort by similarity score
      const enhancedLabs = allLabs
        .map((lab: LabAnalysis) => ({
          ...lab,
          ...labAnalysis.find((l) => l.id === lab.id),
        }))
        .sort(
          (a: LabAnalysis, b: LabAnalysis) =>
            (b.similarity_score || 0) - (a.similarity_score || 0)
        );

      setLabs(enhancedLabs);
    } catch (err) {
      console.error("Error processing image:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to process image. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-4">LabConnect</h1>
      <p className="mb-4 text-gray-600">
        Upload your resume to find matching labs
      </p>

      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-md">
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="mb-4 block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />

        <button
          onClick={processImageAndFetchLabs}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading || !image}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Analyzing...
            </span>
          ) : (
            "Find Matching Labs"
          )}
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {labs.length > 0 ? (
            labs.map((lab) => (
              <div
                key={lab.id}
                className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">
                      {lab["Lab Name"]}
                    </h2>
                    <div className="mt-2 space-y-1 text-gray-600">
                      <p>
                        <span className="font-medium">Professor:</span>{" "}
                        {lab["Professor Name"]}
                      </p>
                      <p>
                        <span className="font-medium">Match Score:</span>{" "}
                        {lab.similarity_score && (
                          <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                            {lab.similarity_score}/5
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  {lab.similarity_score && lab.similarity_score >= 4 && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                      Top Match
                    </span>
                  )}
                </div>

                {lab.match_reason && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm font-medium text-gray-700">
                      Matching Factors:
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {lab.match_reason}
                    </p>
                  </div>
                )}

                <p className="mt-3 text-gray-700 text-sm">{lab.Description}</p>
                <p className="mt-2 text-sm text-blue-600">
                  {lab["How to apply"]}
                </p>
              </div>
            ))
          ) : (
            !loading &&
            !error && (
              <p className="text-gray-500 text-center">
                Upload a resume to find matching labs
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}