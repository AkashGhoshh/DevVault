package com.dumpyard.dto;

import jakarta.validation.constraints.NotNull;

public record UpdatePasteRequest(
        String title,
        @NotNull(message = "Content cannot be null") String content
) {
    public UpdatePasteRequest(String content) {
        this("", content);
    }
}
