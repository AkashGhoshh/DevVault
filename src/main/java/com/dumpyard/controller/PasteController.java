package com.dumpyard.controller;

import com.dumpyard.entity.Paste;
import com.dumpyard.entity.PasteRevision;
import com.dumpyard.repository.PasteRepository;
import com.dumpyard.repository.PasteRevisionRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/pastes")
public class PasteController {

    private final PasteRepository pasteRepository;
    private final PasteRevisionRepository revisionRepository;

    public PasteController(PasteRepository pasteRepository, PasteRevisionRepository revisionRepository) {
        this.pasteRepository = pasteRepository;
        this.revisionRepository = revisionRepository;
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> createPaste(@RequestBody Map<String, String> payload) {
        String content = payload.getOrDefault("content", "");
        
        Paste paste = new Paste();
        paste.setContent(content);
        paste.setOwnerToken(UUID.randomUUID().toString().replace("-", ""));
        paste.setSuggestToken(UUID.randomUUID().toString().replace("-", ""));
        paste.setReadToken(UUID.randomUUID().toString().replace("-", ""));
        paste.setCreatedAt(LocalDateTime.now());
        paste.setUpdatedAt(LocalDateTime.now());
        
        paste = pasteRepository.save(paste);
        
        Map<String, String> response = new HashMap<>();
        response.put("ownerToken", paste.getOwnerToken());
        response.put("suggestToken", paste.getSuggestToken());
        response.put("readToken", paste.getReadToken());
        
        return ResponseEntity.ok(response);
    }

    @GetMapping("/read/{token}")
    public ResponseEntity<Map<String, Object>> readPaste(@PathVariable String token) {
        return pasteRepository.findByReadToken(token)
                .map(paste -> {
                    Map<String, Object> res = new HashMap<>();
                    res.put("content", paste.getContent());
                    res.put("role", "read");
                    return ResponseEntity.ok(res);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/suggest/{token}")
    public ResponseEntity<Map<String, Object>> getSuggestPaste(@PathVariable String token) {
        return pasteRepository.findBySuggestToken(token)
                .map(paste -> {
                    Map<String, Object> res = new HashMap<>();
                    res.put("content", paste.getContent());
                    res.put("role", "suggest");
                    return ResponseEntity.ok(res);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/suggest/{token}")
    public ResponseEntity<String> submitSuggestion(@PathVariable String token, @RequestBody Map<String, String> payload) {
        return pasteRepository.findBySuggestToken(token)
                .map(paste -> {
                    String newContent = payload.getOrDefault("content", "");
                    
                    PasteRevision revision = new PasteRevision();
                    revision.setPaste(paste);
                    revision.setProposedContent(newContent);
                    revision.setStatus(PasteRevision.RevisionStatus.PENDING);
                    revision.setSubmittedAt(LocalDateTime.now());
                    
                    revisionRepository.save(revision);
                    return ResponseEntity.ok("Suggestion submitted successfully.");
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/owner/{token}")
    public ResponseEntity<Map<String, Object>> getOwnerPaste(@PathVariable String token) {
        return pasteRepository.findByOwnerToken(token)
                .map(paste -> {
                    Map<String, Object> res = new HashMap<>();
                    res.put("content", paste.getContent());
                    res.put("ownerToken", paste.getOwnerToken());
                    res.put("suggestToken", paste.getSuggestToken());
                    res.put("readToken", paste.getReadToken());
                    res.put("role", "owner");
                    
                    List<PasteRevision> pendingRevisions = revisionRepository.findByPasteIdAndStatusOrderBySubmittedAtDesc(
                            paste.getId(), PasteRevision.RevisionStatus.PENDING);
                    
                    res.put("pendingEdits", pendingRevisions.stream().map(rev -> {
                        Map<String, Object> revMap = new HashMap<>();
                        revMap.put("id", rev.getId());
                        revMap.put("proposedContent", rev.getProposedContent());
                        revMap.put("submittedAt", rev.getSubmittedAt());
                        return revMap;
                    }).toList());
                    
                    return ResponseEntity.ok(res);
                })
                .orElse(ResponseEntity.notFound().build());
    }
    
    @PutMapping("/owner/{token}")
    public ResponseEntity<String> updateDirectly(@PathVariable String token, @RequestBody Map<String, String> payload) {
        return pasteRepository.findByOwnerToken(token)
                .map(paste -> {
                    paste.setContent(payload.getOrDefault("content", ""));
                    paste.setUpdatedAt(LocalDateTime.now());
                    pasteRepository.save(paste);
                    return ResponseEntity.ok("Updated directly.");
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/owner/{token}/approve/{revisionId}")
    public ResponseEntity<String> approveSuggestion(@PathVariable String token, @PathVariable Long revisionId) {
        return pasteRepository.findByOwnerToken(token).map(paste -> {
            return revisionRepository.findById(revisionId).map(revision -> {
                if (!revision.getPaste().getId().equals(paste.getId())) {
                    return ResponseEntity.badRequest().body("Revision does not belong to this paste.");
                }
                
                revision.setStatus(PasteRevision.RevisionStatus.APPROVED);
                revisionRepository.save(revision);
                
                paste.setContent(revision.getProposedContent());
                paste.setUpdatedAt(LocalDateTime.now());
                pasteRepository.save(paste);
                
                return ResponseEntity.ok("Suggestion approved.");
            }).orElse(ResponseEntity.notFound().build());
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/owner/{token}/reject/{revisionId}")
    public ResponseEntity<String> rejectSuggestion(@PathVariable String token, @PathVariable Long revisionId) {
        return pasteRepository.findByOwnerToken(token).map(paste -> {
            return revisionRepository.findById(revisionId).map(revision -> {
                if (!revision.getPaste().getId().equals(paste.getId())) {
                    return ResponseEntity.badRequest().body("Revision does not belong to this paste.");
                }
                
                revision.setStatus(PasteRevision.RevisionStatus.REJECTED);
                revisionRepository.save(revision);
                
                return ResponseEntity.ok("Suggestion rejected.");
            }).orElse(ResponseEntity.notFound().build());
        }).orElse(ResponseEntity.notFound().build());
    }
}
