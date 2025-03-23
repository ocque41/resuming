"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';

interface CustomCaptchaGameProps {
  onSuccess: (token: string) => void;
  onError: () => void;
}

const generateRandomToken = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const CustomCaptchaGame: React.FC<CustomCaptchaGameProps> = ({ onSuccess, onError }) => {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [targetNumber, setTargetNumber] = useState(0);
  const [currentNumber, setCurrentNumber] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startGame = () => {
    setGameStarted(true);
    setGameCompleted(false);
    setError(null);
    setCurrentNumber(0);
    // Generate a random number between 5 and 10
    setTargetNumber(Math.floor(Math.random() * 6) + 5);
  };

  const handleClick = () => {
    if (loading || gameCompleted) return;
    
    setCurrentNumber(prev => prev + 1);
    if (currentNumber + 1 === targetNumber) {
      setLoading(true);
      setGameCompleted(true);
      
      // Generate a verification token when the game is completed
      setTimeout(() => {
        setLoading(false);
        const token = generateRandomToken();
        onSuccess(token);
      }, 1000);
    }
  };

  const resetGame = () => {
    setGameStarted(false);
    setGameCompleted(false);
    setCurrentNumber(0);
    setError(null);
  };

  useEffect(() => {
    if (gameStarted && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw background
        ctx.fillStyle = '#f9fafb';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw text instruction
        ctx.fillStyle = '#111827';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Click exactly ${targetNumber} times`, canvas.width / 2, 30);
        
        // Draw progress
        ctx.fillStyle = '#4f46e5';
        ctx.font = '24px Arial';
        ctx.fillText(`${currentNumber} / ${targetNumber}`, canvas.width / 2, canvas.height / 2 + 10);
      }
    }
  }, [gameStarted, currentNumber, targetNumber]);

  return (
    <Card className="w-full max-w-md p-4 shadow-md">
      <div className="flex flex-col items-center space-y-4">
        <h3 className="text-lg font-medium">Verify you're human</h3>
        
        {!gameStarted ? (
          <Button 
            onClick={startGame}
            className="w-full"
          >
            Start Verification
          </Button>
        ) : (
          <>
            <canvas 
              ref={canvasRef} 
              width={300} 
              height={150} 
              onClick={handleClick}
              className="border border-gray-200 rounded-md cursor-pointer"
            />
            
            {gameCompleted ? (
              <div className="flex items-center text-green-600">
                <Icons.check className="w-5 h-5 mr-2" />
                <span>Verification successful!</span>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Click on the box above exactly {targetNumber} times
              </p>
            )}

            {error && (
              <div className="text-red-500 text-sm">
                {error}
              </div>
            )}
            
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={resetGame}
                disabled={loading}
              >
                Reset
              </Button>
              
              {loading && (
                <div className="flex items-center">
                  <Icons.spinner className="w-5 h-5 mr-2 animate-spin" />
                  <span>Verifying...</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

export default CustomCaptchaGame; 