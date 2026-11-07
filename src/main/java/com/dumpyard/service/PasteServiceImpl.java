package com.dumpyard.service;

import com.dumpyard.dto.CreatePasteRequest;
import com.dumpyard.dto.PasteResponse;
import com.dumpyard.dto.UpdatePasteRequest;
import com.dumpyard.entity.Paste;
import com.dumpyard.exception.PasteNotFoundException;
import com.dumpyard.repository.PasteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class PasteServiceImpl implements PasteService {

    private final PasteRepository pasteRepository;

    public PasteServiceImpl(PasteRepository pasteRepository) {
        this.pasteRepository = pasteRepository;
    }

    @Override
    @Transactional
    public PasteResponse createPaste(CreatePasteRequest request) {
        Paste paste = new Paste();
        paste.setTitle(request.title() != null && !request.title().isBlank() ? request.title() : "Untitled Note");
        paste.setContent(request.content());
        paste.setCreatedAt(LocalDateTime.now());
        paste.setUpdatedAt(LocalDateTime.now());

        Paste saved = pasteRepository.save(paste);
        return toResponse(saved);
    }

    @Override
    public PasteResponse getPaste(Long id) {
        Paste paste = pasteRepository.findById(id)
                .orElseThrow(() -> new PasteNotFoundException("Paste not found with id: " + id));
        return toResponse(paste);
    }

    @Override
    public List<PasteResponse> getAllPastes() {
        return pasteRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional
    public PasteResponse updatePaste(Long id, UpdatePasteRequest request) {
        Paste paste = pasteRepository.findById(id)
                .orElseThrow(() -> new PasteNotFoundException("Paste not found with id: " + id));

        if (request.title() != null && !request.title().isBlank()) {
            paste.setTitle(request.title());
        }
        paste.setContent(request.content());
        paste.setUpdatedAt(LocalDateTime.now());

        Paste updated = pasteRepository.save(paste);
        return toResponse(updated);
    }

    @Override
    @Transactional
    public void deletePaste(Long id) {
        if (!pasteRepository.existsById(id)) {
            throw new PasteNotFoundException("Paste not found with id: " + id);
        }
        pasteRepository.deleteById(id);
    }

    private PasteResponse toResponse(Paste paste) {
        return new PasteResponse(
                paste.getId(),
                paste.getTitle(),
                paste.getContent(),
                paste.getCreatedAt(),
                paste.getUpdatedAt()
        );
    }
}
