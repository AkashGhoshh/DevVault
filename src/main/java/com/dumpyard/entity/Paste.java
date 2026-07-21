package com.dumpyard.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
public class Paste {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(unique = true, nullable = false)
    private String ownerToken;

    @Column(unique = true, nullable = false)
    private String suggestToken;

    @Column(unique = true, nullable = false)
    private String readToken;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    
    public String getOwnerToken() { return ownerToken; }
    public void setOwnerToken(String ownerToken) { this.ownerToken = ownerToken; }
    
    public String getSuggestToken() { return suggestToken; }
    public void setSuggestToken(String suggestToken) { this.suggestToken = suggestToken; }
    
    public String getReadToken() { return readToken; }
    public void setReadToken(String readToken) { this.readToken = readToken; }
    
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
