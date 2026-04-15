const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
  const apiKey = "AIzaSyDFHTP2OK3NgsPlfVxu69yJTo2pTgrqbmM"; 
  const genAI = new GoogleGenerativeAI(apiKey);
  
  console.log("--- Listando Modelos (v1) ---");
  try {
     // Note: listModels is usually on the genAI instance or requires specific setup
     // In REST, it's GET /v1/models
     // SDK version 0.24.1 might have slightly different call
     // But let's try a simple fetch if SDK fails
     const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
     const data = await response.json();
     console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Erro ao listar modelos:", error.message);
  }
}

listModels();
