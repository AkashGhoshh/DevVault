package com.dumpyard.dto;

import jakarta.validation.constraints.NotNull;

public record CreatePasteRequest(
        String title,
        @NotNull(message = "Content cannot be null") String content
) {
    public CreatePasteRequest(String content) {
        this("", content);
    }
}
