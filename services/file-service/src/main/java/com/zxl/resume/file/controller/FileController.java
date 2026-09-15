package com.zxl.resume.file.controller;

import com.zxl.resume.common.annotation.UserId;
import com.zxl.resume.common.result.R;
import io.minio.*;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final MinioClient minioClient;

    @Value("${minio.bucket}")
    private String bucket;

    @Value("${minio.public-endpoint:http://localhost:9000}")
    private String publicEndpoint;

    private static final List<String> ALLOWED_TYPES = List.of(
            "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
            "application/pdf"
    );
    private static final long MAX_SIZE = 10 * 1024 * 1024L;

    /** 通用文件上传，返回可直接访问的 URL */
    @PostMapping("/upload")
    public R<Map<String, Object>> upload(@RequestParam("file") MultipartFile file,
                                         @UserId UUID userId) {
        validate(file);
        String objectName = "uploads/" + userId + "/" + UUID.randomUUID() + extensionOf(file.getOriginalFilename());
        putObject(objectName, file);
        return R.ok(Map.of(
                "url", publicEndpoint + "/" + bucket + "/" + objectName,
                "objectName", objectName,
                "size", file.getSize(),
                "contentType", file.getContentType() == null ? "" : file.getContentType()
        ));
    }

    /** 头像上传，固定目录便于管理与缓存 */
    @PostMapping("/avatar")
    public R<Map<String, Object>> uploadAvatar(@RequestParam("file") MultipartFile file,
                                               @UserId UUID userId) {
        validate(file);
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("头像仅支持图片格式");
        }
        String objectName = "avatars/" + userId + extensionOf(file.getOriginalFilename());
        putObject(objectName, file);
        return R.ok(Map.of(
                "url", publicEndpoint + "/" + bucket + "/" + objectName + "?v=" + System.currentTimeMillis()
        ));
    }

    /** 生成临时下载链接（分享 PDF 等场景） */
    @GetMapping("/presigned")
    public R<String> presigned(@RequestParam String objectName) {
        try {
            String url = minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(bucket)
                            .object(objectName)
                            .expiry(1, TimeUnit.HOURS)
                            .build());
            return R.ok(url);
        } catch (Exception e) {
            throw new RuntimeException("生成下载链接失败: " + e.getMessage());
        }
    }

    // ------------------------------------------------------------------

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("请选择要上传的文件");
        }
        if (file.getSize() > MAX_SIZE) {
            throw new IllegalArgumentException("文件大小不能超过 10MB");
        }
        String contentType = file.getContentType();
        if (contentType != null && !ALLOWED_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("不支持的文件类型：" + contentType);
        }
    }

    private void putObject(String objectName, MultipartFile file) {
        try {
            boolean found = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
            if (!found) {
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                // 公开读策略，便于前端直接展示图片
                minioClient.setBucketPolicy(SetBucketPolicyArgs.builder()
                        .bucket(bucket)
                        .config(publicReadPolicy(bucket))
                        .build());
            }
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .stream(file.getInputStream(), file.getSize(), -1)
                    .contentType(file.getContentType())
                    .build());
        } catch (Exception e) {
            log.error("上传文件失败", e);
            throw new RuntimeException("文件上传失败: " + e.getMessage());
        }
    }

    private static String extensionOf(String filename) {
        if (filename == null || !filename.contains(".")) return "";
        return filename.substring(filename.lastIndexOf(".")).toLowerCase();
    }

    private static String publicReadPolicy(String bucket) {
        return """
                {
                  "Version": "2012-10-17",
                  "Statement": [{
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": ["arn:aws:s3:::%s/*"]
                  }]
                }
                """.formatted(bucket);
    }
}
