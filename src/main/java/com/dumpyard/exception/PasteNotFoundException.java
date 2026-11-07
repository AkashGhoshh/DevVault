package com.dumpyard.exception;

public class PasteNotFoundException extends RuntimeException {
    public PasteNotFoundException(String message) {
        super(message);
    }
}
