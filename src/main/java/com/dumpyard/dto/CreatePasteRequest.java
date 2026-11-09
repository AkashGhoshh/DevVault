package com.dumpyard.dto;

import jakarta.validation.constraints.NotNull;

public record CreatePasteRequest(
        String title,
        @NotNull(message = "Content cannot be null") String content,
        String tags,
        Boolean isPinned,
        String folder
) {
    public CreatePasteRequest(String content) {
        this("", content, "", false, "General");
    }

    public CreatePasteRequest(String title, String content) {
        this(title, content, "", false, "General");
    }

    public CreatePasteRequest(String title, String content, String tags, Boolean isPinned) {
        this(title, content, tags, isPinned, "General");
    }
}
