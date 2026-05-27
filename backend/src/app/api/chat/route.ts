import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, Tool, GenerateContentRequest } from '@google/generative-ai';
import { CoreBridge } from '@/lib/core-bridge';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const coreBridge = new CoreBridge();

// Define tools for Gemini
const tools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'query_route',
        description: 'Queries the transit engine for optimal routes between two stations.',
        parameters: {
          type: 'object',
          properties: {
            origin: { type: 'string', description: 'The ID of the origin station.' },
            destination: { type: 'string', description: 'The ID of the destination station.' },
            departureTime: { type: 'number', description: 'Departure time in seconds from midnight.' }
          },
          required: ['origin', 'destination', 'departureTime']
        }
      },
      {
        name: 'get_stations',
        description: 'Returns a list of all available transit stations.',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    ]
  }
];

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      tools: tools,
    });

    const chat = model.startChat({
      history: messages.slice(0, -1).map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
    });

    const lastMessage = messages[messages.length - 1].content;
    let result = await chat.sendMessage(lastMessage);
    let response = result.response;

    // Handle function calls
    const functionCalls = response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      const toolResults = [];

      for (const call of functionCalls) {
        if (call.name === 'query_route') {
          const { origin, destination, departureTime } = call.args as any;
          const routes = coreBridge.queryRoute(origin, destination, departureTime);
          toolResults.push({
            functionResponse: {
              name: 'query_route',
              response: { routes }
            }
          });
        } else if (call.name === 'get_stations') {
          const stations = coreBridge.getStations();
          toolResults.push({
            functionResponse: {
              name: 'get_stations',
              response: { stations }
            }
          });
        }
      }

      // Send the tool results back to Gemini to get the final text response
      result = await chat.sendMessage(toolResults);
      response = result.response;
    }

    return NextResponse.json({
      content: response.text(),
      role: 'assistant'
    });

  } catch (error: any) {
    console.error('[API_CHAT] Error:', error.message || error);
    return NextResponse.json({
      content: `I'm sorry, I encountered an error: ${error.message}`,
      role: 'assistant'
    }, { status: 500 });
  }
}
