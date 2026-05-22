from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import ollama
import json

app = FastAPI(title="Crypto Wallet AI Agent")

class ChatRequest(BaseModel):
    message: str

@app.post("/ai/chat")
async def chat_endpoint(request: ChatRequest):
    system_prompt = """
    You are an AI assistant for a crypto wallet. 
    If the user asks a general question, reply normally.
    If the user wants to send money or crypto, you MUST output ONLY a valid JSON object in this exact format:
    {
      "reply": "Confirmation message",
      "action": "send_money",
      "data": {"amount": 0, "to": "Name"}
    }
    CRITICAL: Output the raw JSON only. DO NOT wrap the response in ```json or any markdown blocks.
    """

    try:
        response = ollama.chat(model='gemma2:2b', messages=[
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': request.message}
        ])
        
        raw_content = response['message']['content']
        
        clean_content = raw_content.replace('```json', '').replace('```', '').strip()
        
        try:
            parsed_json = json.loads(clean_content)
            return parsed_json 
        except json.JSONDecodeError:
            return {
                "reply": clean_content
            }
            
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=503, detail="AI unavailable")

